import { Injectable, NotFoundException, ForbiddenException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Diploma } from './entities/diploma.entity';
import { DiplomaRequest, DiplomaRequestStatus } from './entities/diploma-request.entity';
import { DiplomaRequestSignature } from './entities/diploma-request-signature.entity';
import { DiplomaAnchorSignature } from './entities/anchor-signature.entity';
import { CreateDiplomaDto } from './dto/create-diploma.dto';
import { CreateDiplomaRequestDto } from './dto/create-diploma-request.dto';
import { SignDiplomaRequestDto } from './dto/sign-diploma-request.dto';

@Injectable()
export class DiplomasService {
  constructor(
    @InjectRepository(Diploma)
    private diplomaRepository: Repository<Diploma>,
    @InjectRepository(DiplomaRequest)
    private diplomaRequestRepository: Repository<DiplomaRequest>,
  @InjectRepository(DiplomaRequestSignature)
  private signatureRepository: Repository<DiplomaRequestSignature>,
  @InjectRepository(DiplomaAnchorSignature)
  private anchorSignatureRepo: Repository<DiplomaAnchorSignature>,
  ) {}

  // --- Cache mémoire léger KPI ---
  private kpiCache: { data: any; ts: number } | null = null;
  private graduatedCache: { data: any; ts: number } | null = null;
  private readonly KPI_TTL_MS = 60_000; // 60s

  private isFresh(entry: { ts: number } | null) {
    return !!entry && (Date.now() - entry.ts) < this.KPI_TTL_MS;
  }

  private invalidateKpi() {
    this.kpiCache = null;
    this.graduatedCache = null;
  }

  /**
   * Retourne des KPI agrégés pour l'affichage dans le dashboard
   * - totalDiplomas: nombre de templates de diplômes actifs
   * - totalRequests: nombre total de demandes (tous statuts)
   * - pendingRequests: demandes en attente de validation (PENDING)
   * - readyForAnchor: demandes prêtes pour ancrage
   * - anchoredRequests: demandes ancrées on-chain
   */
  async getKpiMetrics() {
    const cache = this.kpiCache;
    if (cache && this.isFresh(cache)) {
      return cache.data;
    }
    const [totalDiplomas, totalRequests, pendingRequests, readyForAnchor, anchoredRequests] = await Promise.all([
      this.diplomaRepository.count({ where: { isActive: true } }),
      this.diplomaRequestRepository.count(),
      this.diplomaRequestRepository.count({ where: { status: DiplomaRequestStatus.PENDING } }),
      this.diplomaRequestRepository.count({ where: { status: DiplomaRequestStatus.READY_FOR_ANCHOR } }),
      this.diplomaRequestRepository.count({ where: { status: DiplomaRequestStatus.ANCHORED } }),
    ]);
    const payload = { totalDiplomas, totalRequests, pendingRequests, readyForAnchor, anchoredRequests };
    this.kpiCache = { data: payload, ts: Date.now() };
    return payload;
  }

  /**
   * Compte approximatif des étudiants diplômés = somme des studentIds distincts
   * des demandes ANCHORED. (Optimisation possible via requête SQL plus poussée.)
   */
  async countGraduatedStudents(): Promise<{ graduatedStudents: number; anchoredRequests: number; }> {
    if (this.graduatedCache && this.isFresh(this.graduatedCache)) {
      return this.graduatedCache.data;
    }
    const anchored = await this.diplomaRequestRepository.find({
      where: { status: DiplomaRequestStatus.ANCHORED },
      select: ['studentIds', 'id'],
    });
    const set = new Set<string>();
    anchored.forEach(r => r.studentIds?.forEach(id => set.add(id)));
    const data = { graduatedStudents: set.size, anchoredRequests: anchored.length };
    this.graduatedCache = { data, ts: Date.now() };
    return data;
  }

  async getUserWalletAddress(authToken: string): Promise<string> {
    try {
      const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://tuvcb-service-auth:3001';
      const response = await fetch(`${authServiceUrl}/auth/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Auth service responded with status: ${response.status}`);
      }

      const userData = await response.json();
      console.log('User data from auth service:', userData);
      
      // Le service d'authentification peut retourner l'adresse dans 'address' ou 'walletAddress'
      const walletAddress = userData.address || userData.walletAddress;
      
      if (!walletAddress) {
        throw new Error('No wallet address found in user data');
      }
      
      return walletAddress;
    } catch (error) {
      console.error('Error fetching user wallet address:', error);
      throw new HttpException('Unable to verify user authentication', HttpStatus.UNAUTHORIZED);
    }
  }

  async getUserById(authToken: string): Promise<any> {
    try {
      const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://tuvcb-service-auth:3001';
      const response = await fetch(`${authServiceUrl}/auth/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Auth service responded with status: ${response.status}`);
      }

      const userData = await response.json();
      return userData;
    } catch (error) {
      console.error('Error fetching user data:', error);
      throw new HttpException('Unable to verify user authentication', HttpStatus.UNAUTHORIZED);
    }
  }

  async getUserWalletByUserId(userId: string): Promise<string> {
    try {
      const usersServiceUrl = process.env.USERS_SERVICE_URL || 'http://tuvcb-service-users:3003';
      const response = await fetch(`${usersServiceUrl}/users/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Users service responded with status: ${response.status}`);
      }

      const userData = await response.json();
      const walletAddress = userData.address || userData.walletAddress;
      
      if (!walletAddress) {
        throw new Error(`No wallet address found for user ${userId}`);
      }
      
      return walletAddress;
    } catch (error) {
      console.error(`Error fetching wallet for user ${userId}:`, error);
      throw new HttpException(`Unable to get wallet address for user ${userId}`, HttpStatus.BAD_REQUEST);
    }
  }

  // Ajouter une méthode pour obtenir les adresses wallet des signataires requis
  async getSignerWalletAddresses(requiredSignatures: string[]): Promise<{[userId: string]: string}> {
    const walletAddresses: {[userId: string]: string} = {};
    
    for (const userId of requiredSignatures) {
      try {
        const walletAddress = await this.getUserWalletByUserId(userId);
        walletAddresses[userId] = walletAddress;
      } catch (error) {
        console.error(`Error getting wallet address for user ${userId}:`, error);
        // On peut décider de continuer sans cette adresse ou lever une exception
        throw new HttpException(`Cannot get wallet address for required signer ${userId}`, HttpStatus.BAD_REQUEST);
      }
    }
    
    return walletAddresses;
  }

  // Méthode pour vérifier si un utilisateur peut signer une demande via blockchain
  async canUserSignWithWallet(requestId: string, userWalletAddress: string): Promise<boolean> {
    const request = await this.findOneDiplomaRequest(requestId);
    
    // Obtenir les adresses wallet de tous les signataires requis
    const signerWallets = await this.getSignerWalletAddresses(request.requiredSignatures);
    
    // Vérifier si l'adresse wallet de l'utilisateur est dans les adresses autorisées
    return Object.values(signerWallets).includes(userWalletAddress);
  }
  async createDiploma(createDiplomaDto: CreateDiplomaDto): Promise<Diploma> {
    const diploma = this.diplomaRepository.create(createDiplomaDto);
    return await this.diplomaRepository.save(diploma);
  }

  async findAllDiplomas(): Promise<Diploma[]> {
    return await this.diplomaRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOneDiploma(id: string): Promise<Diploma> {
    const diploma = await this.diplomaRepository.findOne({ where: { id } });
    if (!diploma) {
      throw new NotFoundException('Diploma not found');
    }
    return diploma;
  }

  // Gestion des demandes de diplômes
  async createDiplomaRequest(
    createDiplomaRequestDto: CreateDiplomaRequestDto,
    authToken: string,
  ): Promise<DiplomaRequest> {
    console.log('=== CREATE DIPLOMA REQUEST SERVICE ===');
    console.log('DTO:', createDiplomaRequestDto);
    console.log('Auth Token received:', authToken ? 'Present' : 'Missing');
    
    // Récupérer les informations de l'utilisateur authentifié
    const currentUser = await this.getUserById(authToken);
    console.log('Current user:', currentUser);
    
    // Vérifier que le diplôme existe
    await this.findOneDiploma(createDiplomaRequestDto.diplomaId);

    const diplomaRequest = this.diplomaRequestRepository.create({
      ...createDiplomaRequestDto,
      createdBy: currentUser.id, // Utiliser l'ID utilisateur au lieu de l'adresse wallet
    });

    console.log('Diploma request before save:', diplomaRequest);

    const savedRequest = await this.diplomaRequestRepository.save(diplomaRequest);

    // Créer les signatures requises avec les IDs utilisateurs
    const signatures = createDiplomaRequestDto.requiredSignatures.map(userId => 
      this.signatureRepository.create({
        diplomaRequestId: savedRequest.id,
        userId: userId, // Utiliser directement l'ID utilisateur
      })
    );

    await this.signatureRepository.save(signatures);

    return this.findOneDiplomaRequest(savedRequest.id);
  }

  async findAllDiplomaRequests(): Promise<DiplomaRequest[]> {
    return await this.diplomaRequestRepository.find({
      relations: ['diploma', 'signatures'],
      order: { createdAt: 'DESC' },
    });
  }

  async findDiplomaRequestsByUser(authToken: string): Promise<DiplomaRequest[]> {
    // Récupérer les informations de l'utilisateur authentifié
    const currentUser = await this.getUserById(authToken);
    const currentUserId = currentUser.id;
    
    // Récupérer toutes les demandes où l'utilisateur est soit créateur, soit signataire requis
    const allRequests = await this.diplomaRequestRepository.find({
      relations: ['diploma', 'signatures'],
      order: { createdAt: 'DESC' },
    });

    // Filtrer les demandes selon les critères
    return allRequests.filter(request => {
      // L'utilisateur est le créateur
      if (request.createdBy === currentUserId) {
        return true;
      }
      
      // L'utilisateur est dans les signataires requis (par ID utilisateur)
      if (request.requiredSignatures.includes(currentUserId)) {
        return true;
      }
      
      return false;
    });
  }

  async findOneDiplomaRequest(id: string): Promise<DiplomaRequest> {
    const request = await this.diplomaRequestRepository.findOne({
      where: { id },
      relations: ['diploma', 'signatures'],
    });
    
    if (!request) {
      throw new NotFoundException('Diploma request not found');
    }
    
    return request;
  }

  async signDiplomaRequest(
    requestId: string,
    authToken: string,
    signDto: SignDiplomaRequestDto,
  ): Promise<DiplomaRequest> {
    // Récupérer les informations de l'utilisateur authentifié
    const currentUser = await this.getUserById(authToken);
    const currentUserId = currentUser.id;
    const currentUserWalletAddress = await this.getUserWalletAddress(authToken);
    
    const request = await this.findOneDiplomaRequest(requestId);

    // Vérifier que l'utilisateur peut signer (par ID utilisateur)
    if (!request.requiredSignatures.includes(currentUserId)) {
      throw new ForbiddenException('You are not authorized to sign this request');
    }

    // Vérifier si l'utilisateur a déjà signé (par ID utilisateur)
    const existingSignature = await this.signatureRepository.findOne({
      where: {
        diplomaRequestId: requestId,
        userId: currentUserId, // Utiliser l'ID utilisateur
        isSigned: true,
      },
    });

    if (existingSignature) {
      throw new BadRequestException('You have already signed this request');
    }

    // Mettre à jour ou créer la signature (avec ID utilisateur)
    let signature = await this.signatureRepository.findOne({
      where: {
        diplomaRequestId: requestId,
        userId: currentUserId, // Utiliser l'ID utilisateur
      },
    });

    if (!signature) {
      signature = this.signatureRepository.create({
        diplomaRequestId: requestId,
        userId: currentUserId, // Utiliser l'ID utilisateur
      });
    }

    signature.isSigned = signDto.approve;
    signature.signatureComment = signDto.signatureComment || null;
    signature.signedAt = new Date();

    await this.signatureRepository.save(signature);

    // Mettre à jour le compteur de signatures valides
    const validSignatures = await this.signatureRepository.count({
      where: {
        diplomaRequestId: requestId,
        isSigned: true,
      },
    });

    request.validSignatures = validSignatures;

    // Vérifier si toutes les signatures sont obtenues
    if (validSignatures >= request.requiredSignatures.length) {
  request.status = DiplomaRequestStatus.APPROVED;
  // Une fois approuvé il devient prêt pour ancrage (étape intermédiaire)
  request.status = DiplomaRequestStatus.READY_FOR_ANCHOR;
    } else if (!signDto.approve) {
      request.status = DiplomaRequestStatus.REJECTED;
    }

    await this.diplomaRequestRepository.save(request);

    return this.findOneDiplomaRequest(requestId);
  }

  async deleteDiplomaRequest(requestId: string, authToken: string): Promise<void> {
    // Récupérer les informations de l'utilisateur authentifié
    const currentUser = await this.getUserById(authToken);
    const currentUserId = currentUser.id;
    
    const request = await this.findOneDiplomaRequest(requestId);

    if (request.createdBy !== currentUserId) {
      throw new ForbiddenException('You can only delete your own requests');
    }

    if (request.status !== DiplomaRequestStatus.PENDING) {
      throw new BadRequestException('Cannot delete a processed request');
    }

    // Supprimer les signatures associées
    await this.signatureRepository.delete({ diplomaRequestId: requestId });
    
    // Supprimer la demande
    await this.diplomaRequestRepository.delete(requestId);
  }

  // Marquer une demande comme "ancrage demandé" pour éviter doublons
  async requestAnchor(requestId: string, authToken: string, batchId: string, diplomeLabel: string, signer?: string, signature?: string) {
    const currentUser = await this.getUserById(authToken);
    const request = await this.findOneDiplomaRequest(requestId);
    if (request.status !== DiplomaRequestStatus.READY_FOR_ANCHOR) {
      throw new BadRequestException('Request not ready for anchoring');
    }
    if (request.anchorRequested) {
      throw new BadRequestException('Anchor already requested');
    }
    request.anchorRequested = true;
    request.anchorBatchId = batchId;
    request.anchorDiplomeLabel = diplomeLabel;
    await this.diplomaRequestRepository.save(request);
    if (signer && signature) {
      const message = `Anchor diploma batch ${batchId} for request ${requestId}`;
      const record = this.anchorSignatureRepo.create({
        diplomaRequestId: requestId,
        signerAddress: signer,
        message,
        signature,
      });
      await this.anchorSignatureRepo.save(record);
    }
    return request;
  }

  // Finaliser ancrage après retour blockchain
  async confirmAnchored(requestId: string, txHash: string) {
    const request = await this.findOneDiplomaRequest(requestId);
    if (!request.anchorRequested) throw new BadRequestException('Anchor not requested');
    request.status = DiplomaRequestStatus.ANCHORED;
    request.anchorTxHash = txHash;
    await this.diplomaRequestRepository.save(request);
    return request;
  }
}
