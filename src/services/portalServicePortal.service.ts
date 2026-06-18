import "../models/associations";
import PortalService from "../models/portalService.model";
import PortalServiceSubmission from "../models/portalServiceSubmission.model";
import { getPortalContext } from "./customerPortal.service";
import { logPortalActivityFromContext } from "./portalActivity.service";
import {
  normalizeFormFields,
  PortalServiceFormField,
} from "../types/portalServiceForm";

const validateSubmissionData = (
  formFields: PortalServiceFormField[],
  formData: Record<string, unknown>
) => {
  const errors: string[] = [];
  const cleaned: Record<string, unknown> = {};

  for (const field of formFields) {
    const raw = formData[field.name];
    const value =
      raw == null
        ? ""
        : typeof raw === "string"
          ? raw.trim()
          : String(raw).trim();

    if (field.required && !value) {
      errors.push(`${field.label} is required`);
      continue;
    }

    if (!value) continue;

    if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors.push(`${field.label} must be a valid email`);
      continue;
    }

    if (field.type === "number" && Number.isNaN(Number(value))) {
      errors.push(`${field.label} must be a number`);
      continue;
    }

    if (field.type === "select" && field.options?.length) {
      if (!field.options.includes(value)) {
        errors.push(`${field.label} has an invalid option`);
        continue;
      }
    }

    cleaned[field.name] = field.type === "number" ? Number(value) : value;
  }

  if (errors.length) {
    throw new Error(errors.join("; "));
  }

  return cleaned;
};

export const listCustomerPortalServices = async (
  portalCustomerId: number,
  brandId: number
) => {
  await getPortalContext(portalCustomerId, brandId);

  const rows = await PortalService.findAll({
    where: { brandId, status: "active" },
    order: [
      ["sortOrder", "ASC"],
      ["id", "ASC"],
    ],
    attributes: [
      "id",
      "name",
      "slug",
      "shortDescription",
      "iconUrl",
      "sortOrder",
    ],
  });

  return rows.map((r) => r.toJSON());
};

export const getCustomerPortalServiceBySlug = async (
  portalCustomerId: number,
  brandId: number,
  slug: string
) => {
  await getPortalContext(portalCustomerId, brandId);

  const service = await PortalService.findOne({
    where: {
      brandId,
      slug: slug.trim().toLowerCase(),
      status: "active",
    },
    attributes: [
      "id",
      "name",
      "slug",
      "shortDescription",
      "detailedContent",
      "iconUrl",
      "sortOrder",
      "formFields",
    ],
  });

  if (!service) throw new Error("Service not found");
  const json = service.toJSON();
  return {
    ...json,
    formFields: normalizeFormFields(json.formFields),
  };
};

export const submitCustomerPortalServiceForm = async (
  portalCustomerId: number,
  brandId: number,
  slug: string,
  formData: Record<string, unknown>
) => {
  const { account } = await getPortalContext(portalCustomerId, brandId);

  const service = await PortalService.findOne({
    where: {
      brandId,
      slug: slug.trim().toLowerCase(),
      status: "active",
    },
  });

  if (!service) throw new Error("Service not found");

  const formFields = normalizeFormFields(service.formFields);
  if (!formFields.length) {
    throw new Error("This service has no form configured");
  }

  const cleaned = validateSubmissionData(formFields, formData || {});

  const submission = await PortalServiceSubmission.create({
    serviceId: service.id,
    brandId,
    customerAccountId: account.id,
    portalCustomerId,
    formData: cleaned,
    status: "new",
    submittedAt: new Date(),
  });

  await logPortalActivityFromContext(
    account,
    portalCustomerId,
    "service_form_submitted",
    {
      title: `Submitted: ${service.name}`,
      metadata: {
        serviceId: service.id,
        serviceSlug: service.slug,
        submissionId: submission.id,
      },
      skipDedupe: true,
    }
  );

  return {
    submissionId: submission.id,
    serviceId: service.id,
    serviceName: service.name,
    status: submission.status,
    submittedAt: submission.submittedAt,
  };
};
