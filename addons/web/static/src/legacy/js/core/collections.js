/** @odoo-module alias=web.collections **/
    
    import Class from "web.Class";

    /**
     * Allows to build a tree representation of a data.
     */
    var Tree = Class.extend({
        /**
         * @constructor
         * @param {*} data - the data associated to the root node
         */
        init: function (data) {
            this._data = data;
            this._children = [];
        },

        //----------------------------------------------------------------------
        // Public
        //----------------------------------------------------------------------

        /**
         * Returns the root's associated data.
         *
         * @returns {*}
         */
        getData: function () {
            return this._data;
        },
        /**
         * Adds a child tree.
         *
         * @param {Tree} tree
         */
        addChild: function (tree) {
            this._children.push(tree);
        },
    });

    export default {
        Tree: Tree,
    };
