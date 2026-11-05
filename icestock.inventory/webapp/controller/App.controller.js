/* App.controller.js
= 공통 네비게이션
: App.view.xml에서 버튼을 클릭하면 App.controller.js의 메서드 실행 
(예시 코드)
  // Dashboard 메뉴 클릭 시 실행
  onDashboard() {
      // dashboard 라우트로 이동
      this.getOwnerComponent().getRouter().navTo("dashboard");
  },

  // Product 메뉴 클릭 시 실행
  onProduct() {
      // product 라우트로 이동
      this.getOwnerComponent().getRouter().navTo("product");
  },

  // Stock Movement 메뉴 클릭 시 실행
  onStockMovement() {
      // stockMovement 라우트로 이동
      this.getOwnerComponent().getRouter().navTo("stockMovement");
  }
*/
sap.ui.define([
  "sap/ui/core/mvc/Controller"
], (BaseController) => {
  "use strict";

  return BaseController.extend("icestock.inventory.icestock.inventory.controller.App", {
      onInit() {
      }
  });
});