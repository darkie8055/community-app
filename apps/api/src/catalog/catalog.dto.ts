import {
  IsString,
  IsIn,
  IsOptional,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsUUID,
  Matches,
} from "class-validator";
import { Type, Transform } from "class-transformer";
export class ItemDto {
  @IsIn(["post", "notice", "listing", "property", "service"]) kind!: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;
  @IsString() @MaxLength(3000) description = "";
  @IsString() @MaxLength(60) category = "";
  @IsInt() @Min(0) @Max(2000000000) price = 0;
  @IsIn([
    "community",
    "house",
    "chair",
    "sofa",
    "car",
    "decor",
    "bicycle",
    "cleaning",
    "painting",
    "moving",
    "ac",
  ])
  image_asset = "community";
  @IsOptional() @IsString() @MaxLength(500) photo_key?: string;
  @IsOptional() @IsUUID() unit_id?: string;
  @IsOptional() @IsIn(["sell", "rent"]) listing_type?: string;
  @IsOptional() @IsInt() @Min(0) @Max(20) bedrooms?: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) available_on?: string;
  @IsIn(["draft", "published"]) status = "published";
}
export class ItemQuery {
  @IsOptional()
  @IsIn(["post", "notice", "listing", "property", "service"])
  kind?: string;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsIn(["true", "false"]) saved?: string;
  @IsOptional() @IsIn(["true", "false"]) mine?: string;
  @IsOptional() @IsUUID() cursor?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}
export class ItemStatusDto {
  @IsIn(["draft", "published", "closed"]) status!: string;
}
export class MessageDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  message!: string;
}
export class ServiceRequestDto {
  @IsUUID() unit_id!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) scheduled_on!: string;
  @IsString() @MaxLength(1000) note = "";
}
export class ServiceStatusDto {
  @IsIn(["accepted", "completed", "cancelled"]) status!: string;
}
