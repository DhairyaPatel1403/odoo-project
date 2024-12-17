/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { standardFieldProps } from "../standard_field_props";
import { uuid } from "../../utils";
import { PropertyDefinition } from "./property_definition";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { PropertyValue } from "./property_value";
import { useService } from "@web/core/utils/hooks";
import { usePopover } from "@web/core/popover/popover_hook";
import { sprintf } from "@web/core/utils/strings";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { reposition } from "@web/core/position_hook";
import { archParseBoolean } from "@web/views/utils";

import { Component, useRef, useState, useEffect, onWillStart } from "@odoo/owl";

export class PropertiesField extends Component {
    static template = "web.PropertiesField";
    static components = {
        Dropdown,
        DropdownItem,
        PropertyDefinition,
        PropertyValue,
    };
    static props = {
        ...standardFieldProps,
        context: { type: Object, optional: true },
        columns: { type: Number, optional: true },
        hideAddButton: { type: Boolean, optional: true },
        hideKanbanOption: { type: Boolean, optional: true },
    };

    setup() {
        this.notification = useService("notification");
        this.orm = useService("orm");
        this.user = useService("user");
        this.dialogService = useService("dialog");
        this.popover = usePopover(PropertyDefinition, {
            closeOnClickAway: this.checkPopoverClose,
            popoverClass: "o_property_field_popover",
            position: "top",
            onClose: () => this.onCloseCurrentPopover?.(),
        });
        this.propertiesRef = useRef("properties");

        this.state = useState({
            canChangeDefinition: true,
            movedPropertyName: null,
            hideAddButton: this.props.hideAddButton,
        });

        this._saveInitialPropertiesValues();

        const field = this.props.record.fields[this.props.name];
        this.definitionRecordField = field.definition_record;

        onWillStart(async () => {
            await this._checkDefinitionAccess();
        });

        useEffect(() => {
            this._movePopoverIfNeeded();

            if (this.openLastPropertyDefinition) {
                this.openLastPropertyDefinition = null;
                const propertiesList = this.propertiesList;
                const lastPropertyName = propertiesList[propertiesList.length - 1].name;
                const labels = this.propertiesRef.el.querySelectorAll(
                    `.o_property_field[property-name="${lastPropertyName}"] .o_field_property_open_popover`
                );
                const lastLabel = labels[labels.length - 1];
                this._openPropertyDefinition(lastLabel, lastPropertyName, true);
            }
        });
    }

    /* --------------------------------------------------------
     * Public methods / Getters
     * -------------------------------------------------------- */

    /**
     * Return the current properties value.
     *
     * Make a deep copy of this properties values, so when we will modify it
     * in the events, we won't re-use same object (can lead to issue, e.g. if we
     * discard a form view, we should be able to restore the old props).
     *
     * @returns {array}
     */
    get propertiesList() {
        const propertiesValues = (this.props.record.data[this.props.name] || []).map(property => {
            if (["date", "datetime"].includes(property.type)) {
                // Date and Datetime are immutable luxon objects.
                return property;
            }
            return JSON.parse(JSON.stringify(property));
        });
        return propertiesValues.filter((definition) => !definition.definition_deleted);
    }

    /**
     * Return the current properties value splitted in multiple groups/columns.
     *
     * @returns {Array<Array>}
     */
    get groupedPropertiesList() {
        const columns = this.env.isSmall ? 1 : this.props.columns;
        // If no properties, assure that the "Add Property" button is shown.
        const res = [...Array(columns)].map((col) => []);
        this.propertiesList.forEach((val, index) => {
            res[index % columns].push(val);
        });
        return res;
    }

    /**
     * Return the id of the definition record.
     *
     * @returns {integer}
     */
    get definitionRecordId() {
        return this.props.record.data[this.definitionRecordField][0];
    }

    /**
     * Return the model of the definition record.
     *
     * @returns {string}
     */
    get definitionRecordModel() {
        return this.props.record.fields[this.definitionRecordField].relation;
    }

    /**
     * Return true if we should close the popover containing the
     * properties definition based on the target received.
     *
     * If we edit the datetime, it will open a popover with the date picker
     * component, but this component won't be a child of the current popover.
     * So when we will click on it to select a date, it will close the definition
     * popover. It's the same for other similar components (many2one modal, etc).
     *
     * @param {HTMLElement} target
     * @returns {boolean}
     */
    checkPopoverClose(target) {
        if (target.closest(".o_datetime_picker")) {
            // selected a datetime, do not close the definition popover
            return false;
        }

        if (target.closest(".modal")) {
            // close a many2one modal
            return false;
        }

        if (target.closest(".o_tag_popover")) {
            // tag color popover
            return false;
        }

        if (target.closest(".o_model_field_selector_popover")) {
            // domain selector
            return false;
        }

        return true;
    }

    /**
     * Generate an unique ID to be used in the DOM.
     *
     * @returns {string}
     */
    generateUniqueDomID() {
        return `property_${uuid()}`;
    }

    /* --------------------------------------------------------
     * Event handlers
     * -------------------------------------------------------- */

    /**
     * Move the given property up or down in the list.
     *
     * @param {string} propertyName
     * @param {string} direction, either "up" or "down"
     */
    onPropertyMove(propertyName, direction) {
        const propertiesValues = this.propertiesList || [];
        const propertyIndex = propertiesValues.findIndex(
            (property) => property.name === propertyName
        );

        const targetIndex = propertyIndex + (direction === "down" ? 1 : -1);
        if (targetIndex < 0 || targetIndex >= propertiesValues.length) {
            this.notification.add(
                direction === "down"
                    ? _lt("This field is already last")
                    : _lt("This field is already first"),
                { type: "warning" }
            );
            return;
        }
        this.state.movedPropertyName = propertyName;

        const prop = propertiesValues[targetIndex];
        propertiesValues[targetIndex] = propertiesValues[propertyIndex];
        propertiesValues[propertyIndex] = prop;
        propertiesValues[propertyIndex].definition_changed = true;
        this.props.record.update({ [this.props.name]: propertiesValues }).then(() => {
            // move the popover once the DOM is updated
            this.shouldUpdatePopoverPosition = true;
        });
    }

    /**
     * The value / definition of the given property has been changed.
     * `propertyValue` contains the definition of the property with the value.
     *
     * @param {string} propertyName
     * @param {object} propertyValue
     */
    onPropertyValueChange(propertyName, propertyValue) {
        const propertiesValues = this.propertiesList;
        propertiesValues.find((property) => property.name === propertyName).value = propertyValue;
        this.props.record.update({ [this.props.name]: propertiesValues });
    }

    /**
     * Check if the definition is not already opened
     * and if it's not the case, open the popover with the property definition.
     *
     * @param {event} event
     * @param {string} propertyName
     */
    async onPropertyEdit(event, propertyName) {
        event.stopPropagation();
        event.preventDefault();
        if (!(await this.checkDefinitionWriteAccess())) {
            this.notification.add(
                _lt("You need to be able to edit parent first to configure property fields"),
                { type: "warning" }
            );
            return;
        }
        if (event.target.classList.contains("disabled")) {
            // remove the glitch if we click on the edit button
            // while the popover is already opened
            return;
        }

        event.target.classList.add("disabled");
        this._openPropertyDefinition(event.target, propertyName, false);
    }

    /**
     * The property definition or value has been changed.
     *
     * @param {object} propertyDefinition
     */
    onPropertyDefinitionChange(propertyDefinition) {
        propertyDefinition["definition_changed"] = true;
        const propertiesValues = this.propertiesList;
        const propertyIndex = propertiesValues.findIndex(
            (property) => property.name === propertyDefinition.name
        );

        this._regeneratePropertyName(propertyDefinition);

        propertiesValues[propertyIndex] = propertyDefinition;
        this.props.record.update({ [this.props.name]: propertiesValues });
    }

    /**
     * Mark a property as "to delete".
     *
     * @param {string} propertyName
     */
    onPropertyDelete(propertyName) {
        this.popover.close();
        const dialogProps = {
            title: _lt("Delete Property Field"),
            body: sprintf(
                _lt(
                    'Are you sure you want to delete this property field? It will be removed for everyone using the "%s" %s.'
                ),
                this.parentName,
                this.parentString
            ),
            confirmLabel: _lt("Delete"),
            confirm: () => {
                const propertiesDefinitions = this.propertiesList;
                propertiesDefinitions.find(
                    (property) => property.name === propertyName
                ).definition_deleted = true;
                this.props.record.update({ [this.props.name]: propertiesDefinitions });
            },
            cancel: () => {},
        };
        this.dialogService.add(ConfirmationDialog, dialogProps);
    }

    async onPropertyCreate() {
        if (!(await this.checkDefinitionWriteAccess())) {
            this.notification.add(
                _lt("You need to be able to edit parent first to configure property fields"),
                { type: "warning" }
            );
            return;
        }
        const propertiesDefinitions = this.propertiesList || [];

        if (
            propertiesDefinitions.length &&
            propertiesDefinitions.some((prop) => !prop.string || !prop.string.length)
        ) {
            // do not allow to add new field until we set a label on the previous one
            this.propertiesRef.el.closest(".o_field_properties").classList.add("o_field_invalid");

            this.notification.add(_lt("Please complete your properties before adding a new one"), {
                type: "warning",
            });
            return;
        }

        this.propertiesRef.el.closest(".o_field_properties").classList.remove("o_field_invalid");

        propertiesDefinitions.push({
            name: uuid(),
            string: sprintf(_lt("Property %s"), propertiesDefinitions.length + 1),
            type: "char",
            definition_changed: true,
        });
        this.openLastPropertyDefinition = true;
        this.state.hideAddButton = false;
        this.props.record.update({ [this.props.name]: propertiesDefinitions });
    }

    /**
     * Verify that we can write on properties, we can not change the definition
     * if we don't have access for parent or if no parent is set.
     */
    async checkDefinitionWriteAccess() {
        if (!this.definitionRecordId || !this.definitionRecordModel) {
            return false;
        }

        try {
            await this.orm.call(
                this.definitionRecordModel,
                "check_access_rule",
                [this.definitionRecordId],
                { operation: "write" }
            );
        } catch {
            return false;
        }
        return true;
    }

    /**
     * The tags list has been changed.
     * If `newValue` is given, update the property value as well.
     *
     * @param {string} propertyName
     * @param {array} newTags
     * @param {array | null} newValue
     */
    onTagsChange(propertyName, newTags, newValue = null) {
        const propertyDefinition = this.propertiesList.find(
            (property) => property.name === propertyName
        );
        propertyDefinition.tags = newTags;
        if (newValue !== null) {
            propertyDefinition.value = newValue;
        }
        propertyDefinition.definition_changed = true;
        this.onPropertyDefinitionChange(propertyDefinition);
    }

    /* --------------------------------------------------------
     * Private methods
     * -------------------------------------------------------- */

    /**
     * Move the popover to the given property id.
     * Used when we change the position of the properties.
     *
     * We change the popover position after the DOM has been updated (see @useEffect)
     * because if we update it after changing the component properties,
     */
    _movePopoverIfNeeded() {
        if (!this.shouldUpdatePopoverPosition) {
            return;
        }
        this.shouldUpdatePopoverPosition = false;

        const propertyName = this.state.movedPropertyName;
        const popover = document
            .querySelector(".o_field_property_definition")
            .closest(".o_popover");
        const targetElement = document.querySelector(
            `.o_property_field[property-name="${propertyName}"] .o_field_property_open_popover`
        );

        reposition(targetElement, popover, null, { position: "top", margin: 10 });

        const arrow = popover.querySelector(".popover-arrow");
        if (arrow) {
            arrow.classList.add("d-none");
        }
    }

    /**
     * Verify that we can write on the parent record,
     * and therefor update the properties definition.
     */
    async _checkDefinitionAccess() {
        this.parentName = this.props.record.data[this.definitionRecordField][1];
        this.parentString = this.props.record.fields[this.definitionRecordField].string;

        if (!this.definitionRecordModel) {
            this.state.canChangeDefinition = false;
            return;
        }

        // check if we can write on the definition record
        this.state.canChangeDefinition = await this.user.checkAccessRight(
            this.definitionRecordModel,
            "write"
        );
    }

    /**
     * Regenerate a new name if needed or restore the original one.
     * (see @_saveInitialPropertiesValues).
     *
     * If the type / model are the same, restore the original name to not reset the
     * children otherwise, generate a new value so all value of the record are reset.
     *
     * @param {object} propertyDefinition
     */
    _regeneratePropertyName(propertyDefinition) {
        const initialValues = this.initialValues[propertyDefinition.name];
        if (
            initialValues &&
            propertyDefinition.type === initialValues.type &&
            propertyDefinition.comodel === initialValues.comodel
        ) {
            // restore the original name
            propertyDefinition.name = initialValues.name;
        } else if (initialValues && initialValues.name === propertyDefinition.name) {
            // Generate a new name to reset all values on other records.
            // because the name has been changed on the definition,
            // the old name on others record won't match the name on the definition
            // and the python field will just ignore the old value.
            // Store the new generated name to be able to restore it
            // if needed.
            const newName = uuid();
            this.initialValues[newName] = initialValues;
            propertyDefinition.name = newName;
        }
    }

    /**
     * If we change the type / model of a property, we will regenerate it's name
     * (like if it was a new property) in order to reset the value of the children.
     *
     * But if we reset the old model / type, we want to be able to discard this
     * modification (even if we save) and restore the original name.
     *
     * For that purpose, we save the original properties values.
     */
    _saveInitialPropertiesValues() {
        // initial properties values, if the type or the model changed, the
        // name will be regenerated in order to reset the value on the children
        this.initialValues = {};
        for (const propertiesValues of this.props.record.data[this.props.name] || []) {
            this.initialValues[propertiesValues.name] = {
                name: propertiesValues.name,
                type: propertiesValues.type,
                comodel: propertiesValues.comodel,
            };
        }
    }

    /**
     * Open the popover with the property definition.
     *
     * @param {DomElement} target
     * @param {string} propertyName
     * @param {boolean} isNewlyCreated
     */
    _openPropertyDefinition(target, propertyName, isNewlyCreated = false) {
        const propertiesList = this.propertiesList;
        const propertyIndex = propertiesList.findIndex(
            (property) => property.name === propertyName
        );

        // maybe the property has been renamed because the type / model
        // changed, retrieve the new one
        const currentName = (propertyName) => {
            const propertiesList = this.propertiesList;
            for (const [newName, initialValue] of Object.entries(this.initialValues)) {
                if (initialValue.name === propertyName) {
                    const prop = propertiesList.find((prop) => prop.name === newName);
                    if (prop) {
                        return newName;
                    }
                }
            }
            return propertyName;
        };

        this.onCloseCurrentPopover = () => {
            this.onCloseCurrentPopover = null;
            this.state.movedPropertyName = null;
            target.classList.remove("disabled");
            if (isNewlyCreated) {
                this._setDefaultPropertyValue(currentName(propertyName));
            }
        };

        this.popover.open(target, {
            readonly: this.props.readonly || !this.state.canChangeDefinition,
            canChangeDefinition: this.state.canChangeDefinition,
            checkDefinitionWriteAccess: () => this.checkDefinitionWriteAccess(),
            propertyDefinition: this.propertiesList.find(
                (property) => property.name === currentName(propertyName)
            ),
            context: this.props.context,
            onChange: this.onPropertyDefinitionChange.bind(this),
            onDelete: () => this.onPropertyDelete(currentName(propertyName)),
            onPropertyMove: (direction) =>
                this.onPropertyMove(currentName(propertyName), direction),
            isNewlyCreated: isNewlyCreated,
            propertyIndex: propertyIndex,
            propertiesSize: propertiesList.length,
            hideKanbanOption: this.props.hideKanbanOption,
        });
    }

    /**
     * Write the default value on the given property.
     *
     * @param {string} propertyName
     */
    _setDefaultPropertyValue(propertyName) {
        const propertiesValues = this.propertiesList;
        const newProperty = propertiesValues.find((property) => property.name === propertyName);
        newProperty.value = newProperty.default;
        // it won't update the props, it's a trick because the onClose event of the popover
        // is called not synchronously, and so if we click on "create a property", it will close
        // the popover, calling this function, but the value will be overwritten because of onPropertyCreate
        this.props.value = propertiesValues;
        this.props.record.update({ [this.props.name]: propertiesValues });
    }
}

export const propertiesField = {
    component: PropertiesField,
    displayName: _lt("Properties"),
    supportedTypes: ["properties"],
    extractProps({ attrs }, dynamicInfo) {
        return {
            context: dynamicInfo.context,
            columns: parseInt(attrs.columns || "1"),
            hideAddButton: archParseBoolean(attrs.hideAddButton),
            hideKanbanOption: archParseBoolean(attrs.hideKanbanOption),
        };
    },
};

registry.category("fields").add("properties", propertiesField);

/**
 * This action is meant to be called from a form client action
 * and will let the user create properties, typically used along
 * with the "hideAddButton" option of the properties field.
 *
 * @param {object} env
 */
async function actionAddProperty(env) {
    const addProperty = document.querySelector(".o_field_property_add button");
    if (addProperty) {
        addProperty.click();
    } else {
        const message = sprintf(env._t("You can not create a new property."));
        env.services.notification.add(message, { type: "danger" });
    }
}

registry.category("actions").add("action_configure_properties_field", actionAddProperty);
