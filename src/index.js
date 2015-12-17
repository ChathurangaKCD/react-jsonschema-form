import React from "react";
import { Validator } from "jsonschema";

const REQUIRED_FIELD_SYMBOL = "*";

class Field extends React.Component {
  get label() {
    if (!this.props.label) {
      return null;
    }
    if (this.props.required) {
      return this.props.label + REQUIRED_FIELD_SYMBOL;
    }
    return this.props.label;
  }

  render() {
    const {type, children} = this.props;
    return (
      <div className={`field field-${type}`}>
        <label>
          {this.label}
          {children}
        </label>
      </div>
    );
  }
}

class TextField extends React.Component {
  onChange(event) {
    this.props.onChange(event.target.value);
  }

  render() {
    const {schema, formData, label, required, placeholder} = this.props;
    const _formData = typeof formData === "string" ? formData : undefined;
    return (
      <Field label={label} required={required}
        type={schema.type}>
        <input type="text"
          value={_formData || schema.default}
          placeholder={placeholder}
          required={required}
          onChange={this.onChange.bind(this)} />
      </Field>
    );
  }
}

class CheckboxField extends React.Component {
  onChange(event) {
    this.props.onChange(event.target.checked);
  }

  render() {
    const {schema, formData, label, required, placeholder} = this.props;
    const _formData = typeof formData === "boolean" ?
                     formData : false;
    return (
      <Field label={label} required={required}
        type={schema.type}>
        <input type="checkbox"
          title={placeholder}
          checked={Boolean(_formData || schema.default)}
          required={required}
          onChange={this.onChange.bind(this)} />
      </Field>
    );
  }
}

class SelectField extends React.Component {
  onChange(event) {
    this.props.onChange(event.target.value);
  }

  render() {
    const {schema, formData, options, required, label} = this.props;
    return (
      <Field label={label} required={required}>
        <select value={formData || schema.default}
          title={schema.description}
          onChange={this.onChange.bind(this)}>{
          options.map((option, i) => {
            return <option key={i}>{option}</option>;
          })
        }</select>
      </Field>
    );
  }
}

class UnsupportedField extends React.Component {
  render() {
    // XXX render json as string so dev can inspect faulty subschema
    return <div className="unsupported-field">
      Unsupported field schema {JSON.stringify(this.props.schema)}.
    </div>;
  }
}

class SchemaField extends React.Component {
  static get fieldComponents() {
    return {
      string: StringField,
      array:  ArrayField,
      boolean: BooleanField,
      object: ObjectField,
      "date-time": StringField,
      number: StringField,
    };
  }

  render() {
    const {schema} = this.props;
    const FieldComponent = SchemaField.fieldComponents[schema.type] ||
      UnsupportedField;
    return <FieldComponent {...this.props} />;
  }
}

class StringField extends React.Component {
  render() {
    const {schema, formData, required, onChange} = this.props;
    const commonProps = {
      schema,
      label:    schema.title,
      formData: formData,
      required: required,
      onChange: onChange.bind(this),
    };
    if (Array.isArray(schema.enum)) {
      return <SelectField options={schema.enum} {...commonProps} />;
    }
    return <TextField placeholder={schema.description} {...commonProps} />;
  }
}

class BooleanField extends React.Component {
  render() {
    const {schema, formData, required, onChange} = this.props;
    const commonProps = {
      schema,
      label:    schema.title,
      formData: formData,
      required: required,
      onChange: onChange.bind(this),
    };
    return <CheckboxField placeholder={schema.description} {...commonProps} />;
  }
}

class ArrayField extends React.Component {
  constructor(props) {
    super(props);
    const formData = Array.isArray(props.formData) ? props.formData : null;
    this.state = {items: formData || props.schema.default || []};
  }

  get itemTitle() {
    const {schema} = this.props;
    return schema.items.title || schema.items.description || "Item";
  }

  defaultItem(itemsSchema) {
    if (itemsSchema.default) {
      return itemsSchema.default;
    }
    switch (itemsSchema.type) {
    case "string": return "";
    case "array":  return [];
    case "boolean": return false;
    case "object": return {};
    default: return undefined;
    }
  }

  isItemRequired(itemsSchema) {
    return itemsSchema.type === "string" && itemsSchema.minLength > 0;
  }

  asyncSetState(state) {
    // ensure state is propagated to parent component when it's actually set
    this.setState(state, _ => this.props.onChange(this.state.items));
  }

  onAddClick(event) {
    event.preventDefault();
    this.setState({
      items: this.state.items.concat(this.defaultItem(this.props.schema.items))
    });
  }

  onDropClick(index, event) {
    event.preventDefault();
    this.setState({
      items: this.state.items.filter((_, i) => i !== index)
    });
  }

  onChange(index, value) {
    this.asyncSetState({
      items: this.state.items.map((item, i) => {
        return index === i ? value : item;
      })
    });
  }

  render() {
    const {schema} = this.props;
    const {items} = this.state;
    return (
      <fieldset
        className={`field field-array field-array-of-${schema.items.type}`}>
        <legend>{schema.title}</legend>
        {schema.description ? <div>{schema.description}</div> : null}
        <div className="array-item-list">{
          items.map((item, index) => {
            return <div key={index}>
              <SchemaField schema={schema.items}
                formData={items[index]}
                required={this.isItemRequired(schema.items)}
                onChange={this.onChange.bind(this, index)} />
              <p className="array-item-remove">
                <button type="button"
                  onClick={this.onDropClick.bind(this, index)}>-</button></p>
            </div>;
          })
        }</div>
        <p className="array-item-add">
          <button type="button" onClick={this.onAddClick.bind(this)}>+</button>
        </p>
      </fieldset>
    );
  }
}

class ObjectField extends React.Component {
  constructor(props) {
    super(props);
    this.state = props.formData || props.schema.default || {};
  }

  isRequired(name) {
    const schema = this.props.schema;
    return Array.isArray(schema.required) &&
      schema.required.indexOf(name) !== -1;
  }

  asyncSetState(state) {
    // ensure state is propagated to parent component when it's actually set
    this.setState(state, _ => this.props.onChange(this.state));
  }

  onChange(name, value) {
    this.asyncSetState({[name]: value});
  }

  render() {
    const {schema} = this.props;
    return <fieldset>
      <legend>{schema.title || "Object"}</legend>
      {
      Object.keys(schema.properties).map((name, index) => {
        return <SchemaField key={index}
          name={name}
          required={this.isRequired(name)}
          schema={schema.properties[name]}
          formData={this.state[name]}
          onChange={this.onChange.bind(this, name)} />;
      })
    }</fieldset>;
  }
}

class ErrorList extends React.Component {
  render() {
    const {errors} = this.props;
    if (errors.length === 0) {
      return null;
    }
    return <div className="errors">
      <h2>Errors</h2>
      <ul>{
        errors.map((error, i) => {
          return <li key={i}>{error.stack}</li>;
        })
      }</ul>
    </div>;
  }
}

export default class Form extends React.Component {
  constructor(props) {
    super(props);
    const edit = !!props.formData;
    const formData = props.formData || this.props.schema.default || {};
    this.state = {
      status: "initial",
      formData,
      edit,
      errors: edit ? this.validate(formData) : []
    };
  }

  validate(formData) {
    const validator = new Validator();
    return validator.validate(formData, this.props.schema).errors;
  }

  renderErrors() {
    if (this.state.edit && this.state.status !== "editing") {
      return <ErrorList errors={this.state.errors} />;
    }
    return null;
  }

  onChange(formData) {
    this.setState({
      status: "editing",
      formData,
      errors: this.validate(formData)
    }, _ => {
      if (this.props.onChange) {
        this.props.onChange(this.state);
      }
    });
  }

  onSubmit(event) {
    event.preventDefault();
    this.setState({status: "submitted"});
    const errors = this.validate(this.state.formData);
    if (Object.keys(errors).length > 0) {
      this.setState({errors}, _ => {
        if (this.props.onError) {
          this.props.onError(errors);
        } else {
          console.error("Form validation failed", errors);
        }
      });
      return;
    } else if (this.props.onSubmit) {
      this.props.onSubmit(this.state);
    }
    this.setState({status: "initial"});
  }

  render() {
    return (
      <form className="generic-form" onSubmit={this.onSubmit.bind(this)}>
        {this.renderErrors()}
        <SchemaField
          schema={this.props.schema}
          formData={this.state.formData}
          onChange={this.onChange.bind(this)} />
        <p><button type="submit">Submit</button></p>
      </form>
    );
  }
}

