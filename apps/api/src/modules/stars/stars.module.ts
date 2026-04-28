import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { StarsController } from "./stars.controller.js";
import { StarsService } from "./stars.service.js";

@Module({
  imports: [JwtModule.register({})],
  controllers: [StarsController],
  providers: [StarsService],
  exports: [StarsService]
})
export class StarsModule {}
