/** @odoo-module alias=website_event_exhibitor.event_exhibitor_connect **/

import { debounce } from "@web/core/utils/timing";
import Dialog from "web.Dialog";
import publicWidget from "web.public.widget";
import {Markup} from "web.utils";

var ExhibitorConnectClosedDialog = Dialog.extend({
    events: Object.assign({}, Dialog.prototype.events, {
        'click .o_wesponsor_js_connect_modal_contry': '_onClickCountryFlag',
    }),
    template: 'exhibitor.connect.closed.modal',

    /**
     * @override
     * @param {Object} parent;
     * @param {Object} options holding a sponsorData obj with required values to
     *   display (see .xml for details);
     */
    init: function (parent, options) {
        options = Object.assign({
            size: 'medium',
            renderHeader: false,
            renderFooter: false,
            backdrop: true,
        }, options || {});
        this.sponsorId = options.sponsorId;
        this._super(parent, options);
    },

    /**
     * @override
     * Wait for fetching sponsor data;
     */
    willStart: function () {
        return Promise.all([
            this._super(...arguments),
            this._fetchSponsor()
        ]);
    },

    //---------------------------------------------------------------------
    // Private
    //---------------------------------------------------------------------

    /**
     * @private
     */
    async _fetchSponsor() {
        const sponsorData = await this._rpc({
            route: `/event_sponsor/${encodeURIComponent(this.sponsorId)}/read`
        });
        sponsorData.website_description = Markup(sponsorData.website_description);
        this.sponsorData = sponsorData;
    },
});


publicWidget.registry.eventExhibitorConnect = publicWidget.Widget.extend({
    selector: '.o_wesponsor_connect_button',
    /**
     * @override
     * @public
     */
    init: function () {
        this._super(...arguments);
        this._onConnectClick = debounce(this._onConnectClick, 500, true);
    },

    /**
     * @override
     * @public
     */
    start: function () {
        var self = this;
        return this._super(...arguments).then(function () {
            self.eventIsOngoing = self.$el.data('eventIsOngoing') || false;
            self.sponsorIsOngoing = self.$el.data('sponsorIsOngoing') || false;
            self.isParticipating = self.$el.data('isParticipating') || false;
            self.userEventManager = self.$el.data('userEventManager') || false;
            self.$el.on('click', self._onConnectClick.bind(self));
        });
    },

    //--------------------------------------------------------------------------
    // Handlers
    //-------------------------------------------------------------------------

    /**
     * @private
     * @param {Event} ev
     * On click, if sponsor is not within opening hours, display a modal instead
     * of redirecting on the sponsor view;
     */
    _onConnectClick: function (ev) {
        ev.stopPropagation();
        ev.preventDefault();

        if (this.userEventManager) {
            document.location = this.$el.data('sponsorUrl');
        } else if (!this.eventIsOngoing && !this.isParticipating) {
            document.location = this.$el.data('registerUrl');
        } else if (!this.eventIsOngoing || ! this.sponsorIsOngoing) {
            return this._openClosedDialog();
        } else {
            document.location = this.$el.data('sponsorUrl');
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _openClosedDialog: function ($element) {
        const sponsorId = this.$el.data('sponsorId');
        return new ExhibitorConnectClosedDialog(
            this, {
                sponsorId: sponsorId,
            }
        ).open();
    },

});


export default {
    ExhibitorConnectClosedDialog: ExhibitorConnectClosedDialog,
    eventExhibitorConnect: publicWidget.registry.eventExhibitorConnect,
};
