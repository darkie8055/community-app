import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Identity } from '../database/database';
import { VisitorPassService } from './visitor-pass.service';

class CreatePassDto {
  @ApiProperty({ default: 24, minimum: 1, maximum: 48 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(48) hours = 24;
}
class VerifyPassDto {
  @ApiProperty({ example: 'ABCD-EFGH-2345' }) @IsString() @MaxLength(32) code!: string;
}
@ApiTags('Visitor passes') @ApiBearerAuth()
@Controller('communities/:community')
export class VisitorPassController {
  constructor(@Inject(VisitorPassService) private passes: VisitorPassService) {}
  @Get('visitor-entries/:id/pass')
  get(@Req() r: {user: Identity}, @Param('community', ParseUUIDPipe) c: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.passes.get(r.user, c, id);
  }
  @Post('visitor-entries/:id/pass')
  create(@Req() r: {user: Identity}, @Param('community', ParseUUIDPipe) c: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreatePassDto) {
    return this.passes.create(r.user, c, id, dto.hours);
  }
  @Delete('visitor-entries/:id/pass')
  revoke(@Req() r: {user: Identity}, @Param('community', ParseUUIDPipe) c: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.passes.revoke(r.user, c, id);
  }
  @Post('visitor-passes/verify') @Throttle({ default: { limit: 20, ttl: 60000 } })
  verify(@Req() r: {user: Identity}, @Param('community', ParseUUIDPipe) c: string, @Body() dto: VerifyPassDto) {
    return this.passes.verify(r.user, c, dto.code);
  }
  @Post('visitor-passes/check-in') @Throttle({ default: { limit: 20, ttl: 60000 } })
  checkIn(@Req() r: {user: Identity}, @Param('community', ParseUUIDPipe) c: string, @Body() dto: VerifyPassDto) {
    return this.passes.checkIn(r.user, c, dto.code);
  }
}
