/*
 * 읽는 순서: onInit → _refreshProducts → onFilterChange
 * 저장 흐름: onCreate/onEdit → _openDialog → onSave → _refreshProducts
 *
 * inventory 모델: Component에서 제공하는 공통 원본 데이터
 * product 모델: 이 화면의 테이블 데이터와 검색 조건
 * form 모델: Dialog에서 편집 중인 임시 값. 취소하면 원본에 저장되지 않는다.
 * 이름 앞의 _는 이 Controller 내부에서 사용하는 함수·변수라는 표시다.
 */
sap.ui.define([
  "sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel",
  "sap/ui/core/Fragment", "sap/m/MessageBox", "sap/m/MessageToast"
], (Controller, JSONModel, Fragment, MessageBox, MessageToast) => {
  "use strict";

  return Controller.extend("icestock.inventory.icestock.inventory.controller.Product", {
    // View가 처음 만들어질 때 한 번 실행한다. 재진입 시 갱신은 라우트 이벤트가 맡는다.
    onInit() {
      // rows: 검색 결과, total: 전체 활성 상품 수, count: 검색 결과 수
      this.getView().setModel(new JSONModel({
        rows: [], categories: [], count: 0, total: 0,
        query: "", category: "ALL", status: "ALL", sort: "DEFAULT"
      }), "product");
      this.getView().setModel(new JSONModel({}), "form");
      this._inventory = this.getOwnerComponent().getModel("inventory");
      // JSON은 비동기로 읽으므로 데이터 로딩이 끝나면 다시 가공한다.
      // 두 번째 인자 this는 콜백에서도 이 Controller를 가리키도록 지정한다.
      this._inventory.attachRequestCompleted(this._refreshProducts, this);
      this._route = this.getOwnerComponent().getRouter().getRoute("product");
      // 상세에서 돌아올 때 원본을 다시 읽되 검색 조건은 유지한다.
      this._route.attachPatternMatched(this._onProductRouteMatched, this);
      // 이미 로딩된 데이터가 있다면 바로 표시한다.
      this._refreshProducts();
    },

    _onProductRouteMatched(event) {
      const argumentsObject = event.getParameter("arguments") || {};
      const query = argumentsObject["?query"] || {};
      const model = this.getView().getModel("product");

      if (query.status === "low") {
        model.setProperty("/status", "부족");
        model.setProperty("/sort", "LOW");
      }

      this._refreshProducts();
    },

    // 원본은 그대로 두고 테이블에 필요한 표시 값만 복사해서 계산한다.
    _refreshProducts() {
      const model = this.getView().getModel("product");
      const categories = this._inventory.getProperty("/categories") || [];
      const sales = this._inventory.getProperty("/sales") || [];
      // 상품 ID별 판매수량 합계. 예: { P001: 25, P002: 10 }
      // || []와 || 0은 데이터 또는 판매 이력이 없을 때의 기본값이다.
      const sold = {};
      sales.forEach((sale) => {
        sold[sale.productId] = (sold[sale.productId] || 0) + sale.quantity;
      });
      // _rows는 검색하기 전 전체 활성 상품이다. filter로 고르고 map으로 가공한다.
      this._rows = (this._inventory.getProperty("/products") || [])
        .filter((product) => product.active)
        .map((product) => {
          const category = categories.find((item) => item.categoryId === product.categoryId);
          const low = product.stock <= product.safetyStock;
          // ...product는 원본 속성을 복사한다. 아래 표시 값은 원본에 추가하지 않는다.
          // stockState는 UI5 색상 표시용 값이며 필요수량은 음수가 되지 않게 한다.
          return {
            ...product,
            categoryName: category ? category.categoryName : product.categoryId,
            soldQuantity: sold[product.productId] || 0,
            stockStatus: low ? "부족" : "정상",
            stockState: low ? "Error" : "Success",
            requiredQuantity: Math.max(product.safetyStock - product.stock, 0)
          };
        });
      // '전체'는 화면 선택창에만 추가한다. setProperty로 연결된 UI에도 변경을 알린다.
      model.setProperty("/categories", [{ categoryId: "ALL", categoryName: "전체 카테고리" }, ...categories]);
      model.setProperty("/total", this._rows.length);
      this.onFilterChange();
    },

    // 검색·필터·정렬을 한 곳에서 처리하여 여러 조건을 동시에 적용한다.
    onFilterChange() {
      const model = this.getView().getModel("product");
      const query = model.getProperty("/query").trim().toLowerCase();
      const category = model.getProperty("/category");
      const status = model.getProperty("/status");
      const sort = model.getProperty("/sort");
      // 코드 또는 이름이 검색어에 맞고 카테고리·재고 조건도 만족해야 한다.
      // ALL이면 해당 조건은 제한하지 않는다.
      const rows = (this._rows || []).filter((product) => {
        return (product.productId.toLowerCase().includes(query) || product.productName.toLowerCase().includes(query)) &&
          (category === "ALL" || product.categoryId === category) &&
          (status === "ALL" || product.stockStatus === status);
      });
      // 반환값이 음수이면 left가 먼저 온다. filter로 만든 새 배열만 정렬한다.
      rows.sort((left, right) => {
        if (sort === "LOW") {
          // 부족한 정도가 큰 상품부터 표시하고 같으면 현재 재고로 비교한다.
          return (left.stock - left.safetyStock) - (right.stock - right.safetyStock) || left.stock - right.stock;
        }
        if (sort === "SALES") { return right.soldQuantity - left.soldQuantity; }
        if (sort === "STOCK") { return right.stock - left.stock; }
        if (sort === "NAME") { return left.productName.localeCompare(right.productName, "ko"); }
        return left.productId.localeCompare(right.productId, undefined, { numeric: true });
      });
      // JSONModel의 기본 목록 제한(100개) 때문에 상품이 잘리지 않도록 늘린다.
      model.setSizeLimit(Math.max(rows.length, 100));
      model.setProperty("/rows", rows);
      model.setProperty("/count", rows.length);
    },

    // SearchField의 현재 입력값을 담고 공통 필터 함수를 실행한다.
    onSearch(event) {
      this.getView().getModel("product").setProperty("/query", event.getSource().getValue());
      this.onFilterChange();
    },

    // 입력 컨트롤도 모델과 연결되어 있어 모델을 초기화하면 화면에 반영된다.
    onResetFilters() {
      const model = this.getView().getModel("product");
      model.setProperty("/query", "");
      model.setProperty("/category", "ALL");
      model.setProperty("/status", "ALL");
      model.setProperty("/sort", "DEFAULT");
      this.onFilterChange();
    },

    // bindingContext는 클릭한 링크/버튼이 속한 상품 행을 가리킨다.
    // 정렬된 행 번호 대신 ID로 이동해야 정확한 상품을 열 수 있다.
    onDetail(event) {
      const product = event.getSource().getBindingContext("product").getObject();
      this.getOwnerComponent().getRouter().navTo("productDetail", {
        // URL에서 특별한 의미를 가진 문자가 포함되어도 코드로 전달되도록 인코딩한다.
        productId: encodeURIComponent(product.productId)
      });
    },

    // 등록 버튼: 기본값과 다음 상품코드를 준비하여 Dialog를 연다.
    onCreate() {
      const products = this._inventory.getProperty("/products");
      const categories = this._inventory.getProperty("/categories") || [];
      if (!products || !categories.length) {
        MessageBox.information("상품 데이터를 불러온 뒤 다시 시도해 주세요.");
        return;
      }
      // 비활성 상품도 포함해 기존 코드와 겹치지 않는 다음 번호를 구한다.
      let next = 1;
      products.forEach((product) => {
        // P 뒤가 숫자인 코드만 검사한다. P009라면 다음 후보는 10이다.
        if (/^P\d+$/.test(product.productId)) {
          next = Math.max(next, Number(product.productId.slice(1)) + 1);
        }
      });
      this._openDialog({
        isNew: true, title: "새 상품 등록", categories,
        productId: "P" + String(next).padStart(3, "0"), productName: "",
        categoryId: categories[0].categoryId, purchasePrice: 0, sellingPrice: 0,
        safetyStock: 10, stock: 0, unit: "EA", active: true
      });
    },

    // 같은 Dialog를 수정에도 사용한다. 복사한 값을 폼에 넣어 원본 변경을 막는다.
    onEdit(event) {
      const product = event.getSource().getBindingContext("product").getObject();
      this._openDialog({
        ...product, isNew: false, title: "상품 정보 수정",
        categories: this._inventory.getProperty("/categories") || []
      });
    },

    // Fragment는 Dialog의 XML 조각이다. 처음 한 번 불러온 뒤 재사용한다.
    async _openDialog(data) {
      this.getView().getModel("form").setData(data);
      if (!this._dialogPromise) {
        this._dialogPromise = Fragment.load({
          // View ID를 붙여 다른 화면과 컨트롤 ID가 겹치지 않게 한다.
          id: this.getView().getId(),
          name: "icestock.inventory.icestock.inventory.view.fragment.ProductDialog",
          controller: this
        }).then((dialog) => {
          // View의 모델을 상속받고 View 종료 시 함께 정리되도록 연결한다.
          this.getView().addDependent(dialog);
          return dialog;
        });
      }
      // XML 로딩이 끝나야 open을 호출할 수 있으므로 완료를 기다린다.
      const dialog = await this._dialogPromise;
      dialog.open();
    },

    // 닫을 때는 저장하지 않는다. 다음 등록/수정 시 form은 새 값으로 교체된다.
    onCloseDialog() {
      this.byId("productDialog").close();
    },

    // 입력 확인 → 신규/수정 분기 → 원본 변경 → 화면용 데이터 재계산
    onSave() {
      const form = this.getView().getModel("form").getData();
      const products = this._inventory.getProperty("/products") || [];
      const id = form.productId.trim();
      const name = form.productName.trim();
      const validCategory = form.categories.some((category) => category.categoryId === form.categoryId);
      // Input 값은 문자열일 수 있으므로 계산·저장 전에 숫자로 바꾼다.
      const purchasePrice = Number(form.purchasePrice);
      const sellingPrice = Number(form.sellingPrice);
      const safetyStock = Number(form.safetyStock);
      // 잘못된 입력은 안내 후 return하여 저장을 중단한다.
      if (!id || !name || !validCategory) {
        MessageBox.warning("상품코드, 상품명, 카테고리를 확인해 주세요.");
        return;
      }
      // 비활성 상품 코드도 포함하며 대소문자만 다른 중복 코드도 막는다.
      if (form.isNew && products.some((product) => product.productId.toLowerCase() === id.toLowerCase())) {
        MessageBox.warning("이미 사용 중인 상품코드입니다.");
        return;
      }
      // 빈 문자열은 Number로 변환하면 0이 되므로 원래 입력값도 확인한다.
      // 단가는 유한한 숫자, 안전재고는 안전하게 표현 가능한 정수인지 검사한다.
      if ([form.purchasePrice, form.sellingPrice, form.safetyStock].some((value) => String(value).trim() === "") ||
          !Number.isFinite(purchasePrice) || purchasePrice < 0 ||
          !Number.isFinite(sellingPrice) || sellingPrice < 0 ||
          !Number.isSafeInteger(safetyStock) || safetyStock < 0) {
        MessageBox.warning("단가는 0 이상의 숫자, 안전재고는 0 이상의 정수로 입력해 주세요.");
        return;
      }
      if (form.isNew) {
        // 최초 재고는 0으로 등록한다. 입출고 이력은 여기서 생성하지 않는다.
        const product = {
          productId: id, productName: name, categoryId: form.categoryId,
          purchasePrice, sellingPrice, safetyStock, stock: 0, unit: "EA", active: true
        };
        // 필요한 원본 필드만 저장한다. 판매수량 같은 화면 가공 값은 저장하지 않는다.
        this._inventory.setProperty("/products", [...products, product]);
      } else {
        // 정렬된 테이블 위치가 아니라 원본 배열에서 ID로 다시 찾는다.
        const index = products.findIndex((product) => product.productId === id);
        if (index < 0) {
          MessageBox.warning("수정할 상품을 찾을 수 없습니다.");
          return;
        }
        // 최신 원본을 기준으로 수정해 현재 재고와 최초 단가는 보존한다.
        this._inventory.setProperty("/products/" + index, {
          ...products[index], productName: name, categoryId: form.categoryId, safetyStock
        });
      }
      // 원본과 화면용 모델은 별개이므로 저장 후 목록도 다시 계산해야 한다.
      this.onCloseDialog();
      this._refreshProducts();
      this.getOwnerComponent().getEventBus().publish("inventory", "changed");
      MessageToast.show("상품 정보를 저장했습니다.");
    },

    // 삭제 대신 active만 false로 바꾸어 과거 이력과의 연결을 보존한다.
    onDeactivate(event) {
      const product = event.getSource().getBindingContext("product").getObject();
      MessageBox.confirm(product.productName + " 상품을 비활성화할까요? 기존 이력은 보존됩니다.", {
        onClose: (action) => {
          // 취소/닫기를 누르면 아무것도 변경하지 않는다.
          if (action !== MessageBox.Action.OK) { return; }
          const products = this._inventory.getProperty("/products") || [];
          const index = products.findIndex((item) => item.productId === product.productId);
          if (index >= 0) {
            this._inventory.setProperty("/products/" + index + "/active", false);
            this._refreshProducts();
            this.getOwnerComponent().getEventBus().publish("inventory", "changed");
            MessageToast.show("상품이 비활성화되었습니다.");
          }
        }
      });
    },

    // View가 파괴될 때 이벤트를 해제해 중복 실행과 불필요한 참조를 막는다.
    onExit() {
      this._inventory.detachRequestCompleted(this._refreshProducts, this);
      this._route.detachPatternMatched(this._onProductRouteMatched, this);
    }
  });
});
