/** @odoo-module alias=web.StandaloneFieldManagerMixin **/

import FieldManagerMixin from 'web.FieldManagerMixin';

/**
 * The StandaloneFieldManagerMixin is a mixin, designed to be used by a widget
 * that instanciates its own field widgets.
 *
 * @mixin
 * @name StandaloneFieldManagerMixin
 * @mixes FieldManagerMixin
 * @property {Function} _confirmChange
 * @property {Function} _registerWidget
 */
var StandaloneFieldManagerMixin = Object.assign({}, FieldManagerMixin, {

    /**
     * @override
     */
    init: function () {
        FieldManagerMixin.init.apply(this, arguments);

        // registeredWidgets is a dict of all field widgets used by the widget
        this.registeredWidgets = {};
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * This method will be called whenever a field value has changed (and has
     * been confirmed by the model).
     *
     * @private
     * @param {string} id basicModel Id for the changed record
     * @param {string[]} fields the fields (names) that have been changed
     * @param {OdooEvent} event the event that triggered the change
     * @returns {Promise}
     */
    _confirmChange: function (id, fields, event) {
        var result = FieldManagerMixin._confirmChange.apply(this, arguments);
        var record = this.model.get(id);
        for (const [fieldName, widget] of Object.entries(this.registeredWidgets[id])) {
            if (fields.includes(fieldName)) {
                widget.reset(record, event);
            }
        }
        return result;
    },

    _registerWidget: function (datapointID, fieldName, widget) {
        if (!this.registeredWidgets[datapointID]) {
            this.registeredWidgets[datapointID] = {};
        }
        this.registeredWidgets[datapointID][fieldName] = widget;
    },
});

export default StandaloneFieldManagerMixin;
