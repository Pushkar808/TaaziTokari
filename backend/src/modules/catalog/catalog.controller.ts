import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/guards/public.decorator';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get()
  getCatalog() {
    return this.catalog.getCatalog();
  }
}
