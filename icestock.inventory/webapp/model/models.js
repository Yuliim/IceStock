sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
], 
function (JSONModel, Device) {
    "use strict";

    return {
        /**
         * Provides runtime information for the device the UI5 app is running on as a JSONModel.
         * @returns {sap.ui.model.json.JSONModel} The device model.
         */
        createDeviceModel: function () {
            var oModel = new JSONModel(Device);
            oModel.setDefaultBindingMode("OneWay");
            return oModel;
        },
        
        // mockData 연결
        /**
         * Provides mock data for the application as a JSONModel.
         * @returns {sap.ui.model.json.JSONModel} The mock data model.
         */
        createInventoryModel: function () {
            var oModel = new JSONModel();           

            oModel.loadData(
                sap.ui.require.toUrl(
                    "icestock/inventory/icestock/inventory/model/mockData.json"
                )
            );

            oModel.setDefaultBindingMode("TwoWay");
            oModel.setSizeLimit(1000);

            return oModel;
        }
    };

});