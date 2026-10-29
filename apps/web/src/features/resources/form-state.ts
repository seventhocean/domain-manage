import {
  resourceInputSchema,
  type Lifecycle,
  type Resource,
  type ResourceInput,
  type ResourceType,
} from "../../../../../packages/contracts";

export type ResourceFormValues = {
  type: ResourceType;
  name: string;
  domain: string;
  address: string;
  managementUrl: string;
  purpose: string;
  price: string;
  specs: string;
  coverImage: string;
  tags: string[];
  notes: string;
  lifecycle: Lifecycle;
  projectIds: string[];
};

const text = (value: unknown) => String(value ?? "");

export function resourceFormDefaults(
  resource?: Resource,
  initialType: ResourceType = "service",
): ResourceFormValues {
  const type = resource?.type || initialType;
  return {
    type,
    name: resource?.name || "",
    domain: text(resource?.details.domain),
    address:
      type === "host"
        ? text(resource?.details.ip)
        : type === "domain"
          ? text(resource?.details.ip_address)
          : resource?.management_url || "",
    managementUrl: resource?.management_url || "",
    purpose: resource?.purpose || "",
    price: text(resource?.details.price),
    specs: text(resource?.details.specs),
    coverImage: text(resource?.details.cover_image),
    tags: [...(resource?.tags || [])],
    notes: resource?.notes || "",
    lifecycle: resource?.lifecycle || "active",
    projectIds: [...(resource?.project_ids || [])],
  };
}

function managementUrl(value: string): string {
  const input = value.trim();
  if (!input) return "";
  return /^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`;
}

export function resourceFormInput(
  values: ResourceFormValues,
  resource?: Resource,
): ResourceInput {
  const details = { ...(resource?.details || {}) };
  // Preserve legacy values and types unless this specific input was changed.
  // In particular, provider and notes are not configuration-field fallbacks.
  const updateDetail = (key: string, value: string) => {
    if (value === text(resource?.details[key])) return;
    if (value.trim()) details[key] = value.trim();
    else delete details[key];
  };
  updateDetail("price", values.price);
  updateDetail("specs", values.specs);
  updateDetail("cover_image", values.coverImage);
  if (values.type === "host") updateDetail("ip", values.address);
  if (values.type === "domain") {
    if (!values.domain.trim()) throw new Error("请填写完整域名");
    updateDetail("domain", values.domain);
    updateDetail("ip_address", values.address);
  }

  return resourceInputSchema.parse({
    type: values.type,
    name:
      values.name.trim() ||
      (values.type === "domain" ? values.domain.trim() : ""),
    purpose: values.purpose,
    lifecycle: values.lifecycle,
    notes: values.notes,
    tags: values.tags,
    management_url: managementUrl(
      values.type === "host" || values.type === "domain"
        ? values.managementUrl
        : values.address,
    ),
    project_ids: values.projectIds,
    details,
  });
}
