/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { Order } from "@point_of_sale/app/store/models";

patch(Order.prototype, "l10n_be_pos_sale.Order", {
    async pay() {
        const has_origin_order = this.get_orderlines().some(line => line.sale_order_origin_id);
        if (this.pos.company.country && this.pos.company.country.code === "BE" && has_origin_order) {
            this.to_invoice = true;
        }
        return this._super(...arguments);
    }
});
