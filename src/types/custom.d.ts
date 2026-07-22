import { Request } from "express";

export interface CustomRequest extends Request {
  user?: {
    id: number;
    permissions: string[];
    permissionDetails?: Array<{
      name?: string;
      resourceId?: number | string | null;
      resourceType?: string | null;
    }>;
  };
  portalBrandId?: number;
}
