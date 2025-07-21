// // utils/filterQuery.ts
// import { Op } from "sequelize";

// export const buildSearchFilter = (
//   search: string,
//   searchableFields: string[]
// ) => {
//   if (!search || searchableFields.length === 0) return {};

//   return {
//     [Op.or]: searchableFields.map((field) => ({
//       [field]: { [Op.iLike]: `%${search}%` }, // Use Op.like for MySQL, Op.iLike for Postgres
//     })),
//   };
// };

// utils/filterQuery.ts

import { Op } from "sequelize";

export const buildSearchFilter = (
  search: string,
  searchableFields: string[]
) => {
  if (!search || searchableFields.length === 0) return {};

  return {
    [Op.or]: searchableFields.map((field) => ({
      [field]: { [Op.like]: `%${search}%` }, // ✅ Use Op.like for MySQL
    })),
  };
};
