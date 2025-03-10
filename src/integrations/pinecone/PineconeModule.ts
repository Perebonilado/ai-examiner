import { Module } from "@nestjs/common";
import { PineconeChunkService } from "./services/PineconeChunksService";
import { ILovePDFModule } from "../i-love-pdf/ILovePDFModule";

@Module({
    imports: [ILovePDFModule],
    providers: [PineconeChunkService],
    exports: [PineconeChunkService]
})
export class PineconeModule {}