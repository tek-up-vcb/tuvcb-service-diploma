import { Controller, Get, Post, Delete, Body, Param, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { DiplomasService } from './diplomas.service';
import { CreateDiplomaDto } from './dto/create-diploma.dto';
import { CreateDiplomaRequestDto } from './dto/create-diploma-request.dto';
import { SignDiplomaRequestDto } from './dto/sign-diploma-request.dto';

@Controller('diplomas')
export class DiplomasController {
  constructor(private readonly diplomasService: DiplomasService) {}

  // Endpoints pour les diplômes
  @Post()
  async createDiploma(@Body() createDiplomaDto: CreateDiplomaDto) {
    return await this.diplomasService.createDiploma(createDiplomaDto);
  }

  @Get()
  async findAllDiplomas() {
    return await this.diplomasService.findAllDiplomas();
  }

  // Endpoints pour les demandes de diplômes (placées avant les routes avec paramètres)
  @Post('requests')
  async createDiplomaRequest(
    @Body() createDiplomaRequestDto: CreateDiplomaRequestDto,
    @Headers('authorization') authorization: string,
  ) {
    console.log('=== CREATE DIPLOMA REQUEST CONTROLLER ===');
    console.log('DTO received:', createDiplomaRequestDto);
    console.log('Authorization header:', authorization ? 'Present' : 'Missing');
    
    // Extraire le token du header Authorization
    const authToken = authorization?.replace('Bearer ', '');
    if (!authToken) {
      throw new Error('No authentication token provided');
    }
    
    return await this.diplomasService.createDiplomaRequest(createDiplomaRequestDto, authToken);
  }

  @Get('requests')
  async findAllDiplomaRequests() {
    return await this.diplomasService.findAllDiplomaRequests();
  }

  @Get('requests/my')
  async findMyDiplomaRequests(@Headers('authorization') authorization: string) {
    const authToken = authorization?.replace('Bearer ', '');
    if (!authToken) {
      throw new Error('No authentication token provided');
    }
    
    return await this.diplomasService.findDiplomaRequestsByUser(authToken);
  }

  @Get('wallet/can-sign/:requestId')
  async canSignWithWallet(
    @Param('requestId') requestId: string,
    @Headers('authorization') authorization: string,
  ) {
    const authToken = authorization?.replace('Bearer ', '');
    if (!authToken) {
      throw new Error('No authentication token provided');
    }
    
    const userWalletAddress = await this.diplomasService.getUserWalletAddress(authToken);
    const canSign = await this.diplomasService.canUserSignWithWallet(requestId, userWalletAddress);
    
    return { canSign, walletAddress: userWalletAddress };
  }

  @Get('requests/:id')
  async findOneDiplomaRequest(@Param('id') id: string) {
    return await this.diplomasService.findOneDiplomaRequest(id);
  }

  @Post('requests/:id/sign')
  @HttpCode(HttpStatus.OK)
  async signDiplomaRequest(
    @Param('id') id: string,
    @Headers('authorization') authorization: string,
    @Body() signDto: SignDiplomaRequestDto,
  ) {
    const authToken = authorization?.replace('Bearer ', '');
    if (!authToken) {
      throw new Error('No authentication token provided');
    }
    
    return await this.diplomasService.signDiplomaRequest(id, authToken, signDto);
  }

  @Delete('requests/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDiplomaRequest(
    @Param('id') id: string,
    @Headers('authorization') authorization: string,
  ) {
    const authToken = authorization?.replace('Bearer ', '');
    if (!authToken) {
      throw new Error('No authentication token provided');
    }
    
    await this.diplomasService.deleteDiplomaRequest(id, authToken);
  }

  // Demander ancrage (verrouille pour ne pas refaire)
  @Post('requests/:id/anchor-request')
  async requestAnchor(
    @Param('id') id: string,
    @Headers('authorization') authorization: string,
    @Body() body: { batchId: string; diplomeLabel: string; signer?: string; signature?: string }
  ) {
    const authToken = authorization?.replace('Bearer ', '');
    if (!authToken) throw new Error('No authentication token provided');
    return this.diplomasService.requestAnchor(id, authToken, body.batchId, body.diplomeLabel, body.signer, body.signature);
  }

  // Confirmer ancrage après tx blockchain
  @Post('requests/:id/anchor-confirm')
  async confirmAnchor(
    @Param('id') id: string,
    @Body() body: { txHash: string }
  ) {
    return this.diplomasService.confirmAnchored(id, body.txHash);
  }

  // Endpoints pour les diplômes (routes avec paramètres à la fin)
  @Get(':id')
  async findOneDiploma(@Param('id') id: string) {
    return await this.diplomasService.findOneDiploma(id);
  }

  // KPIs agrégés (templates + demandes)
  @Get('kpi/metrics/all')
  async getDiplomaKpis() {
    return this.diplomasService.getKpiMetrics();
  }

  // Nombre d'étudiants diplômés (distinct sur demandes ancrées)
  @Get('kpi/graduated-students')
  async getGraduatedStudents() {
    return this.diplomasService.countGraduatedStudents();
  }
}
