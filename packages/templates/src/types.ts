import type { Field, GroupField } from 'payload';

export type TemplateFieldConfig = {
  /** Field name used in the consuming collection, global, or block. */
  name: string;
  /** Name of a template registered with templatesPlugin. */
  template: string;
} & Pick<GroupField, 'label' | 'admin'>;

export type TemplateConfig = {
  /** Fields editable on this template's managed document. */
  fields: Field[];
  /** Data applied only when the managed document is first created. */
  initialData?: Record<string, unknown>;
  /** Human-readable document title. */
  label: string;
  /** Stable, unique template identifier. Letters, numbers, and underscores only. */
  name: string;
};

export type TemplatesPluginConfig = {
  /** Enable or disable the plugin. */
  enabled?: boolean;
  /** The complete set of template documents managed by the plugin. */
  templates: TemplateConfig[];
};
