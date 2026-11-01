import { Transform, Type } from "class-transformer";
import {
  IsString,
  MinLength,
  MaxLength,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsIn,
  IsOptional,
  Matches,
  IsBoolean,
  IsISO8601,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
export class CommunityDto {
  @ApiProperty() @Transform(({ value }) => typeof value === "string" ? value.trim() : value) @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @ApiProperty() @Transform(({ value }) => typeof value === "string" ? value.trim() : value) @IsString() @MinLength(4) @MaxLength(300) address!: string;
  @ApiProperty() @Transform(({ value }) => typeof value === "string" ? value.trim() : value) @IsString() @MinLength(2) @MaxLength(100) city!: string;
}
export class BlockDto {
  @ApiProperty() @Transform(({ value }) => typeof value === "string" ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(30) name!: string;
}
export class FloorDto {
  @ApiProperty() @IsUUID() block_id!: string;
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(-5)
  @Max(200)
  number!: number;
}
export class UnitDto {
  @ApiProperty() @IsUUID() floor_id!: string;
  @ApiProperty() @Transform(({ value }) => typeof value === "string" ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(40) label!: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(["flat", "villa"]) kind: string =
    "flat";
}
export class MembershipDto {
  @ApiProperty() @IsUUID() unit_id!: string;
  @ApiProperty() @IsIn(["owner", "tenant", "family"]) role!: string;
}
export class MembershipDecisionDto {
  @ApiProperty() @IsIn(["approved", "rejected"]) status!: string;
}
export class VisitorDto {
  @ApiProperty() @Transform(({ value }) => typeof value === "string" ? value.trim() : value) @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @ApiProperty() @Matches(/^[6-9]\d{9}$/) phone!: string;
  @ApiProperty() @IsUUID() unit_id!: string;
  @ApiProperty() @IsIn(["guest", "delivery", "cab", "service"]) type!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) company = "";
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) purpose = "";
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) vehicle = "";
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  people = 1;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() preapproved = false;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photo_key?: string;
}
export class DecisionDto {
  @ApiProperty() @IsIn(["approved", "denied"]) decision!: string;
}
export class VisitQuery {
  @IsOptional() @IsIn(['guest', 'delivery', 'cab', 'service']) type?: string;
  @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @IsOptional() @IsISO8601({ strict: true }) until?: string;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional()
  @IsIn(["pending", "approved", "denied", "inside", "exited"])
  status?: string;
  @IsOptional() @IsUUID() unit_id?: string;
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}
export class DeviceDto {
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value) @IsString() @MinLength(10) @MaxLength(4096) token!: string;
  @Transform(({ value }) =>
    typeof value === "string" ? value.toLowerCase() : value,
  )
  @IsIn(["android", "ios", "web"])
  platform!: string;
}
export class UploadDto {
  @IsIn(["image/jpeg", "image/png", "image/webp"]) content_type!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(2 * 1024 * 1024) size!: number;
}
