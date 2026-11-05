sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"
], (BaseController, JSONModel) => {
  "use strict";

  return BaseController.extend("icestock.inventory.icestock.inventory.controller.dashboard.MonthlyChart", {
      onInit() {
        let oModel = new JSONModel("/json/products.json");
        this.getView().setModel(oModel);
      }
  });
});