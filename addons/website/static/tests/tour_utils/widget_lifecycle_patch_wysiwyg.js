/** @odoo-module **/

import { onMounted, onWillRender } from "@odoo/owl";
import { patch } from "@web/core/utils/patch";
import { WysiwygAdapterComponent } from "@website/components/wysiwyg_adapter/wysiwyg_adapter";

// Duplicated from "@website/../tests/tour_utils/widget_lifecycle_dep_widget"
// Cannot be imported for some reason, probably because of this being lazy
// loaded?
function addLifecycleStep(step) {
    const localStorageKey = 'widgetAndWysiwygLifecycle';
    const oldValue = window.localStorage.getItem(localStorageKey);
    const newValue = JSON.stringify(JSON.parse(oldValue).concat(step));
    window.localStorage.setItem(localStorageKey, newValue);
}

patch(WysiwygAdapterComponent.prototype, "widget_lifecycle_patch_wysiwyg.wysiwyg", {
    /**
     * @override
     */
    setup() {
        this._super(...arguments);

        // The Wysiwyg class is very messy at the moment: it touches the DOM in
        // onWillStart hook, mixes OWL & legacy widget, etc. Here we want to
        // test "when the Wysiwyg is started"... for now we will settle on
        // testing "the first time it touches the DOM", relying on it to be when
        // he reads what "editable elements" are for the first time, thanks to
        // the `editableElements` method.
        // TODO to be reviewed (probably as soon as we touch the editable DOM
        // only when considered initialized).
        onWillRender(() => {
            this.__consideredInitialized = true;
        });
        onMounted(() => {
            addLifecycleStep('wysiwygStarted');
        });
    },
    /**
     * @override
     */
    editableElements() {
        if (!this.__consideredInitialized) {
            addLifecycleStep('wysiwygStart');
        }
        return this._super(...arguments);
    },
    /**
     * @override
     */
    destroy() {
        addLifecycleStep('wysiwygStop');
        this._super(...arguments);
    },
});
