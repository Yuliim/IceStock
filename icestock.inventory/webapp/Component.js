sap.ui.define([
    "sap/ui/core/UIComponent",
    "icestock/inventory/icestock/inventory/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("icestock.inventory.icestock.inventory.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // 추가: 공통 Inventory 모델
            this.setModel(models.createInventoryModel(), "inventory");

            // enable routing
            this.getRouter().initialize();
        }
    });
});