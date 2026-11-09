sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"
], (BaseController, JSONModel) => {
  "use strict";

  return BaseController.extend("icestock.inventory.icestock.inventory.controller.dashboard.MonthlyChart", {
      onInit() {
        let oModel = new JSONModel("/model/mockData.json");
        this.getView().setModel(oModel);

        oModel.attachRequestCompleted(function () {
        let aMovements = oModel.getProperty("/movements");
        let oSummary = {};

        aMovements.forEach(function (item) {
            let sMonth = item.date.substring(5, 7) + "월";

            if (!oSummary[sMonth]) {
                oSummary[sMonth] = { month: sMonth, inQty: 0, outQty: 0 };
            }

            if (item.type === "IN") {
                oSummary[sMonth].inQty += item.quantity;
            } else if (item.type === "OUT") {
                oSummary[sMonth].outQty += item.quantity;
            }
        });

        let oChartModel = new sap.ui.model.json.JSONModel({
            chartData: Object.values(oSummary)
        });
        
        that.getView().setModel(oChartModel, "chartModel");
    });
    }
  });
});