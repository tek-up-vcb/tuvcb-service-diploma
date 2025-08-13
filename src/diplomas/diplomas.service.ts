import { Injectable, NotFoundException, ForbiddenException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Diploma } from './entities/diploma.entity';
import { DiplomaRequest, DiplomaRequestStatus } from './entities/diploma-request.entity';
import { DiplomaRequestSignature } from './entities/diploma-request-signature.entity';
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
  ) {}

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

  // Gestion des diplômes
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
    
    // Récupérer l'adresse wallet de l'utilisateur authentifié
    const userWalletAddress = await this.getUserWalletAddress(authToken);
    console.log('User wallet address:', userWalletAddress);
    
    // Vérifier que le diplôme existe
    await this.findOneDiploma(createDiplomaRequestDto.diplomaId);

    const diplomaRequest = this.diplomaRequestRepository.create({
      ...createDiplomaRequestDto,
      createdBy: userWalletAddress,
    });

    console.log('Diploma request before save:', diplomaRequest);

    const savedRequest = await this.diplomaRequestRepository.save(diplomaRequest);

    // Créer les signatures requises avec les adresses wallet
    const signatures = createDiplomaRequestDto.requiredSignatures.map(signerAddress => 
      this.signatureRepository.create({
        diplomaRequestId: savedRequest.id,
        userId: signerAddress, // Utiliser directement l'adresse wallet
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

  async findDiplomaRequestsByUser(userWalletAddress: string): Promise<DiplomaRequest[]> {
    // Récupérer toutes les demandes où l'utilisateur est soit créateur, soit signataire requis
    const allRequests = await this.diplomaRequestRepository.find({
      relations: ['diploma', 'signatures'],
      order: { createdAt: 'DESC' },
    });

    // Filtrer les demandes selon les critères
    return allRequests.filter(request => {
      // L'utilisateur est le créateur
      if (request.createdBy === userWalletAddress) {
        return true;
      }
      
      // L'utilisateur est dans les signataires requis (par adresse wallet)
      if (request.requiredSignatures.includes(userWalletAddress)) {
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
    // Récupérer l'adresse wallet de l'utilisateur authentifié
    const userWalletAddress = await this.getUserWalletAddress(authToken);
    
    const request = await this.findOneDiplomaRequest(requestId);

    // Vérifier que l'utilisateur peut signer (par adresse wallet)
    if (!request.requiredSignatures.includes(userWalletAddress)) {
      throw new ForbiddenException('You are not authorized to sign this request');
    }

    // Vérifier si l'utilisateur a déjà signé (par adresse wallet)
    const existingSignature = await this.signatureRepository.findOne({
      where: {
        diplomaRequestId: requestId,
        userId: userWalletAddress, // Utiliser l'adresse wallet
        isSigned: true,
      },
    });

    if (existingSignature) {
      throw new BadRequestException('You have already signed this request');
    }

    // Mettre à jour ou créer la signature (avec adresse wallet)
    let signature = await this.signatureRepository.findOne({
      where: {
        diplomaRequestId: requestId,
        userId: userWalletAddress, // Utiliser l'adresse wallet
      },
    });

    if (!signature) {
      signature = this.signatureRepository.create({
        diplomaRequestId: requestId,
        userId: userWalletAddress, // Utiliser l'adresse wallet
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
    } else if (!signDto.approve) {
      request.status = DiplomaRequestStatus.REJECTED;
    }

    await this.diplomaRequestRepository.save(request);

    return this.findOneDiplomaRequest(requestId);
  }

  async deleteDiplomaRequest(requestId: string, authToken: string): Promise<void> {
    // Récupérer l'adresse wallet de l'utilisateur authentifié
    const userWalletAddress = await this.getUserWalletAddress(authToken);
    
    const request = await this.findOneDiplomaRequest(requestId);

    if (request.createdBy !== userWalletAddress) {
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
}
