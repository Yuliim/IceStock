sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("icestock.inventory.icestock.inventory.controller.MainView", {
        onInit() {
            // controller에서 공통으로 만든 JSON 모델 가져오기 
            var oModel = this.getOwnerComponent().getModel("inventory");

            // 모델의 데이터를 가져오기
            var aProducts = oModel.getProperty("/products");
            console.log("aProducts: ", aProducts);

            var aCategories = oModel.getProperty("/categories");
            console.log("aCategories: ", aCategories);

            var aMovements = oModel.getProperty("/movements");
            console.log("aMovements: ", aMovements);

            var aSales = oModel.getProperty("/sales");
            console.log("aSales: ", aSales);
        }
    });
});