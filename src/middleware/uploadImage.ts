import multer from "multer";
import { Request, Response, NextFunction } from "express";
import cloudinary from "../utils/cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: "uploads",
    allowed_formats: ["jpg", "jpeg", "png", "gif"],
    transformation: [{ width: 500, height: 500, crop: "limit" }],
  }),
});

const upload = multer({ storage });

// Type guard to check for Cloudinary file with 'path'
function isCloudinaryFile(
  file: Express.Multer.File | undefined
): file is Express.Multer.File & { path: string } {
  return !!file && typeof (file as any).path === "string";
}

declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
      body: {
        [key: string]: any;
      };
    }
  }
}

// export const uploadImageMiddleware = (fieldName: string) => {
//   return (req: Request, res: Response, next: NextFunction) => {
//     const multerSingle = upload.single(fieldName);

//     multerSingle(req, res, (err) => {
//       if (err) {
//         return res.status(400).json({ message: "Image upload failed", error: err });
//       }

//       if (!isCloudinaryFile(req.file)) {
//         return res.status(400).json({ message: `No file provided in field ${fieldName}` });
//       }

//       req.body[fieldName] = req.file.path;

//       next();
//     });
//   };
// };

export const uploadImageMiddleware = (
  fieldName: string,
  optional: boolean = false
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const multerSingle = upload.single(fieldName);

    multerSingle(req, res, (err) => {
      if (err) {
        return res
          .status(400)
          .json({ message: "Image upload failed", error: err });
      }

      // If optional and no file provided, continue without error
      if (optional && !req.file) {
        return next();
      }

      // If not optional and no file provided, return error
      if (!optional && !req.file) {
        return res
          .status(400)
          .json({ message: `No file provided in field ${fieldName}` });
      }

      if (!isCloudinaryFile(req.file)) {
        return res
          .status(400)
          .json({ message: `Invalid file provided in field ${fieldName}` });
      }

      req.body[fieldName] = req.file.path;
      next();
    });
  };
};
