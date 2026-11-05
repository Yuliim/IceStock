sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"
], (BaseController, JSONModel) => {
  "use strict";

  return BaseController.extend("icestock.inventory.icestock.inventory.controller.LowStockTable", {
      onInit() {
        let aModel = new JSONModel("/json/products.json");
        this.getView().setModel(aModel);
      }
  });
});