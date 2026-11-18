import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  Inject,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Identity } from "../database/database";
import { ContentService } from "./catalog.service";
import {
  ItemDto,
  ItemQuery,
  ItemStatusDto,
  MessageDto,
  ServiceRequestDto,
  ServiceStatusDto,
} from "./catalog.dto";
type Request = { user: Identity };
@ApiTags("Community, homes, marketplace and services")
@ApiBearerAuth()
@Controller("communities/:community")
export class ContentController {
  constructor(@Inject(ContentService) private service: ContentService) {}
  @Get("items") list(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Query() q: ItemQuery,
  ) {
    return this.service.list(r.user, c, q);
  }
  @Post("items") create(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Body() d: ItemDto,
  ) {
    return this.service.create(r.user, c, d);
  }
  @Get("items/:id") detail(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.detail(r.user, c, id);
  }
  @Post("items/:id/status") status(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: ItemStatusDto,
  ) {
    return this.service.status(r.user, c, id, d.status);
  }
  @Post("items/:id/bookmark") bookmark(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.bookmark(r.user, c, id);
  }
  @Post("items/:id/comments") comment(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: MessageDto,
  ) {
    return this.service.comment(r.user, c, id, d);
  }
  @Post("items/:id/inquiries") inquiry(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: MessageDto,
  ) {
    return this.service.inquire(r.user, c, id, d);
  }
  @Get("inquiries") inquiries(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
  ) {
    return this.service.inquiries(r.user, c);
  }
  @Post("inquiries/:id/reply") reply(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: MessageDto,
  ) {
    return this.service.reply(r.user, c, id, d);
  }
  @Post("items/:id/requests") book(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: ServiceRequestDto,
  ) {
    return this.service.book(r.user, c, id, d);
  }
  @Get("service-requests") requests(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
  ) {
    return this.service.requests(r.user, c);
  }
  @Post("service-requests/:id/status") requestStatus(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: ServiceStatusDto,
  ) {
    return this.service.requestStatus(r.user, c, id, d.status);
  }
}
