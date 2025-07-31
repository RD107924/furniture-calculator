// 等待 HTML 文件完全載入後再執行
document.addEventListener("DOMContentLoaded", () => {
  // --- 1. 資料定義 ---
  const rates = {
    general: { name: "一般家具", weightRate: 22, volumeRate: 125 },
    special_a: { name: "特殊家具A", weightRate: 32, volumeRate: 184 },
    special_b: { name: "特殊家具B", weightRate: 40, volumeRate: 224 },
    special_c: { name: "特殊家具C", weightRate: 50, volumeRate: 274 },
  };
  const MINIMUM_CHARGE = 2000;
  const VOLUME_DIVISOR = 28317;
  const CBM_TO_CAI_FACTOR = 35.3;
  const OVERSIZED_LIMIT = 300;
  let itemCount = 0;

  // --- 2. 獲取 HTML 元素 ---
  const itemList = document.getElementById("itemList");
  const addItemBtn = document.getElementById("addItemBtn");
  const calculateBtn = document.getElementById("calculateBtn");
  const resultsContainer = document.getElementById("resultsContainer");
  const deliveryLocationSelect = document.getElementById("deliveryLocation");

  // --- 3. 核心功能函式 ---

  function addNewItem() {
    itemCount++;
    const itemDiv = document.createElement("div");
    itemDiv.className = "item-group";
    itemDiv.id = `item-${itemCount}`;
    let optionsHtml = "";
    for (const key in rates) {
      optionsHtml += `<option value="${key}">${rates[key].name}</option>`;
    }
    itemDiv.innerHTML = `<h3>貨物 #${itemCount}</h3><div class="calc-method-toggle"><label><input type="radio" name="calc-method-${itemCount}" value="dimensions" checked> 依尺寸 (長x寬x高)</label><label><input type="radio" name="calc-method-${itemCount}" value="cbm"> 依體積 (立方米/方)</label></div><div class="dimensions-input-wrapper"><div class="input-row"><div class="input-wrapper"><label for="length-${itemCount}">長 (cm)</label><input type="number" id="length-${itemCount}" placeholder="例如: 100"></div><div class="input-wrapper"><label for="width-${itemCount}">寬 (cm)</label><input type="number" id="width-${itemCount}" placeholder="例如: 50"></div><div class="input-wrapper"><label for="height-${itemCount}">高 (cm)</label><input type="number" id="height-${itemCount}" placeholder="例如: 60"></div></div></div><div class="cbm-input-wrapper"><div class="input-row"><div class="input-wrapper"><label for="cbm-${itemCount}">立方米 (方)</label><input type="number" id="cbm-${itemCount}" placeholder="例如: 2.5"></div></div></div><div class="input-row"><div class="input-wrapper"><label for="weight-${itemCount}">重量 (kg)</label><input type="number" id="weight-${itemCount}" placeholder="例如: 30"></div><div class="input-wrapper"><label for="type-${itemCount}">家具種類</label><select id="type-${itemCount}">${optionsHtml}</select></div></div>${
      itemCount > 1 ? '<button class="btn-remove">X</button>' : ""
    }`;
    itemList.appendChild(itemDiv);

    const removeBtn = itemDiv.querySelector(".btn-remove");
    if (removeBtn) removeBtn.addEventListener("click", () => itemDiv.remove());

    const radioButtons = itemDiv.querySelectorAll(
      `input[name="calc-method-${itemCount}"]`
    );
    const dimensionsWrapper = itemDiv.querySelector(
      ".dimensions-input-wrapper"
    );
    const cbmWrapper = itemDiv.querySelector(".cbm-input-wrapper");
    radioButtons.forEach((radio) => {
      radio.addEventListener("change", (event) => {
        dimensionsWrapper.style.display =
          event.target.value === "dimensions" ? "block" : "none";
        cbmWrapper.style.display =
          event.target.value === "cbm" ? "block" : "none";
      });
    });
  }

  function calculateTotal() {
    resultsContainer.innerHTML = "";

    const remoteAreaRate = parseFloat(deliveryLocationSelect.value);
    if (isNaN(remoteAreaRate)) {
      alert("請務必選擇一個配送地區！");
      return;
    }

    const itemElements = document.querySelectorAll(".item-group");
    let allItemsData = [];
    let hasOversizedItem = false;
    let totalShipmentVolume = 0;

    // 數據收集與驗證
    allItemsData = Array.from(itemElements)
      .map((itemEl, index) => {
        const id = itemEl.id.split("-")[1];
        const weight = parseFloat(
          document.getElementById(`weight-${id}`).value
        );
        const type = document.getElementById(`type-${id}`).value;
        const calcMethod = itemEl.querySelector(
          `input[name="calc-method-${id}"]:checked`
        ).value;
        let volume = 0,
          length = 0,
          width = 0,
          height = 0,
          cbm = 0;

        if (calcMethod === "dimensions") {
          length = parseFloat(document.getElementById(`length-${id}`).value);
          width = parseFloat(document.getElementById(`width-${id}`).value);
          height = parseFloat(document.getElementById(`height-${id}`).value);
          if (
            isNaN(length) ||
            isNaN(width) ||
            isNaN(height) ||
            isNaN(weight) ||
            length <= 0 ||
            width <= 0 ||
            height <= 0 ||
            weight <= 0
          ) {
            return null;
          }
          volume = Math.ceil((length * width * height) / VOLUME_DIVISOR);
          if (
            length > OVERSIZED_LIMIT ||
            width > OVERSIZED_LIMIT ||
            height > OVERSIZED_LIMIT
          ) {
            hasOversizedItem = true;
          }
        } else {
          cbm = parseFloat(document.getElementById(`cbm-${id}`).value);
          if (isNaN(cbm) || isNaN(weight) || cbm <= 0 || weight <= 0) {
            return null;
          }
          volume = Math.ceil(cbm * CBM_TO_CAI_FACTOR);
        }
        return { id: index + 1, weight, type, volume, cbm, calcMethod };
      })
      .filter((item) => item !== null);

    if (allItemsData.length === 0) {
      alert("請至少填寫一項完整的貨物資料！");
      return;
    }

    // --- NEW LOGIC: 逐筆計算費用 ---
    let initialSeaFreightCost = 0;
    allItemsData.forEach((item) => {
      const rateInfo = rates[item.type];
      item.rateInfo = rateInfo; // 將費率資訊存入項目中，方便顯示

      const itemWeightCost = item.weight * rateInfo.weightRate;
      const itemVolumeCost = item.volume * rateInfo.volumeRate;
      const itemFinalCost = Math.max(itemWeightCost, itemVolumeCost);

      // 將單筆計算結果存回項目物件中
      item.itemWeightCost = itemWeightCost;
      item.itemVolumeCost = itemVolumeCost;
      item.itemFinalCost = itemFinalCost;

      initialSeaFreightCost += itemFinalCost; // 將每筆費用加總
      totalShipmentVolume += item.volume; // 同時計算總材積
    });

    // --- 後續計算流程不變 ---
    const finalSeaFreightCost = Math.max(initialSeaFreightCost, MINIMUM_CHARGE);

    let remoteFee = 0;
    let totalCbm = totalShipmentVolume / CBM_TO_CAI_FACTOR;
    if (remoteAreaRate > 0) {
      remoteFee = totalCbm * remoteAreaRate;
    }

    const finalTotal = finalSeaFreightCost + remoteFee;

    displayResults({
      allItemsData,
      totalShipmentVolume,
      totalCbm,
      initialSeaFreightCost,
      finalSeaFreightCost,
      remoteAreaRate,
      remoteFee,
      hasOversizedItem,
      finalTotal,
    });
  }

  function displayResults(data) {
    const {
      allItemsData,
      totalShipmentVolume,
      totalCbm,
      initialSeaFreightCost,
      finalSeaFreightCost,
      remoteAreaRate,
      remoteFee,
      hasOversizedItem,
      finalTotal,
    } = data;

    let resultsHTML = '<div class="result-section">';

    resultsHTML += `<h4>--- 費用計算明細 (逐筆) ---</h4>`;

    // NEW DISPLAY LOGIC: 遍歷每一筆貨物來顯示其獨立的計算過程
    allItemsData.forEach((item) => {
      resultsHTML += `<p><strong>[貨物 #${item.id} - ${item.rateInfo.name}]</strong><br>`;
      if (item.calcMethod === "cbm" && item.cbm > 0) {
        resultsHTML += `<small style="color:#555;">(此項以立方米輸入: ${item.cbm} 方 × ${CBM_TO_CAI_FACTOR} = ${item.volume} 材)<br></small>`;
      }
      resultsHTML += `材積費用: ${item.volume} 材 × ${
        item.rateInfo.volumeRate
      } = ${Math.round(item.itemVolumeCost).toLocaleString()} 台幣<br>`;
      resultsHTML += `重量費用: ${item.weight} 公斤 × ${
        item.rateInfo.weightRate
      } = ${Math.round(item.itemWeightCost).toLocaleString()} 台幣<br>`;
      resultsHTML += `→ 此筆費用(取較高者): <strong>${Math.round(
        item.itemFinalCost
      ).toLocaleString()} 台幣</strong></p>`;
    });

    resultsHTML += `<hr>`;

    resultsHTML += `<p><strong>初步海運費 (所有項目加總): ${Math.round(
      initialSeaFreightCost
    ).toLocaleString()} 台幣</strong></p>`;

    if (initialSeaFreightCost < MINIMUM_CHARGE) {
      resultsHTML += `<p style="color: #e74c3c;">↳ 未達最低消費 ${MINIMUM_CHARGE} 元，故海運費以低消計: <strong>${finalSeaFreightCost.toLocaleString()} 台幣</strong></p>`;
    } else {
      resultsHTML += `<p style="color: green;">↳ 已超過最低消費，海運費為: <strong>${finalSeaFreightCost.toLocaleString()} 台幣</strong></p>`;
    }

    if (remoteAreaRate > 0) {
      resultsHTML += `<hr>`;
      resultsHTML += `<p><strong>偏遠地區附加費:</strong><br>`;
      resultsHTML += `(總材積 ${totalShipmentVolume} 材 ÷ ${CBM_TO_CAI_FACTOR} = ${totalCbm.toFixed(
        2
      )} 方) × ${remoteAreaRate.toLocaleString()} 元/方<br>`;
      resultsHTML += `→ 費用: <strong>${Math.round(
        remoteFee
      ).toLocaleString()} 台幣</strong></p>`;
    }

    resultsHTML += `</div>`;

    resultsHTML += `
            <div class="result-section" style="text-align: center;">
                <h2>最終總計費用</h2>
                <div class="total-cost">${Math.round(
                  finalTotal
                ).toLocaleString()} 台幣</div>
                <small>(海運費 ${Math.round(
                  finalSeaFreightCost
                ).toLocaleString()} + 偏遠費 ${Math.round(
      remoteFee
    ).toLocaleString()})</small>
            </div>
        `;

    if (hasOversizedItem) {
      resultsHTML += `<div class="final-disclaimer"><strong>提醒：</strong>您的貨物中有單邊超過 300 公分的品項，將會產生超長費 (600元/件 起)，實際費用以入庫報價為準。</div>`;
    }

    resultsHTML += `<div class="final-disclaimer">此試算表僅適用於小跑豬傢俱專線，試算費用僅供參考，最終金額以實際入庫丈量為準。</div>`;

    resultsContainer.innerHTML = resultsHTML;
  }

  // --- 4. 綁定事件監聽 ---
  addItemBtn.addEventListener("click", addNewItem);
  calculateBtn.addEventListener("click", calculateTotal);

  // --- 5. 初始載入 ---
  addNewItem();
});
