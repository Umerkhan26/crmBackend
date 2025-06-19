import handlebars from "handlebars";

export const renderTemplate = (template: string, data: any) => {
  const compiled = handlebars.compile(template);
  return compiled(data);
};
