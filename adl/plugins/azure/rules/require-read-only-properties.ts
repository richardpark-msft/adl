import { Rule } from '@azure-tools/adl.core';
export default <Rule>{
  activation: 'edit',
  id: 'require-read-only-properties',
  meta: {
    severity: 'error',
    description: 'A model property cannot be both readOnly and required. A readOnly property is something that the server sets when returning the model object while required is a property to be set when sending it as a part of the request body.',
    documentationUrl: 'https://github.com/Azure/azure-rest-api-specs/blob/master/documentation/openapi-authoring-automated-guidelines.md#r2056-requiredreadonlyproperties',
  },
  onProperty: (model, property) => {
    if (property.readOnly && property.required) {
      return {
        message: `A property '${property.name}' cannot be marked both as readOnly and required.`,
        suggestions: [
          {
            description: 'Remove readonly keyword.',
            fix: () => {
              property.readOnly = false;
            }
          },
          {
            description: 'Mark this property as optional.',
            fix: () => {
              property.required = false;
            }
          }
        ]
      };
    }

    return;
  }
};