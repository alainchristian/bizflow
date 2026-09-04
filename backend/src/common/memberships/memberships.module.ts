import { Global, Module } from '@nestjs/common';
import { MembershipsService } from './memberships.service.js';

/** Global for the same reason as its sibling foundational modules -- see CommonGuardsModule. */
@Global()
@Module({
  providers: [MembershipsService],
  exports: [MembershipsService],
})
export class MembershipsModule {}
