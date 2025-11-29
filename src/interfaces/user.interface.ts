import { Optional } from "sequelize";
import { VendorAttributes } from "../models/vendor.model";
import { ClientAttributes } from "../models/client.model";

export interface UserAttributes {
  id?: number;
  firstname?: string;
  lastname?: string;
  email?: string;
  password?: string;
  phone?: string;
  address?: string;
  website?: string;
  coverage?: string;
  linkedin?: string;
  userImage?: string | null | undefined;
  vendor?: string;
  userrole?: "admin" | "vendor" | "client";
  smtpemail?: string;
  smtppassword?: string;
  smtpincomingserver?: string;
  smtpoutgoingserver?: string;
  smtpport?: string;
  branchname?: string;
  branchslug?: string;
  branchcountry?: string;
  branchaddress?: string;
  brancheader?: string;
  branchnavbar?: string;
  branchnavtext?: string;
  branchnavhover?: string;
  branchlogo?: string;
  branchlogoheight?: string;
  branchlogowidth?: string;
  status?: "active" | "blocked";
  referred_to?: string;
  last_login?: Date;
  token?: string;
  created_at?: Date;
  updated_at?: Date;
  vendorData?: VendorAttributes;
  clientData?: ClientAttributes;
  roleId?: number;
}

export type UserCreationAttributes = Optional<
  UserAttributes,
  "id" | "created_at" | "updated_at" | "roleId"
>;
