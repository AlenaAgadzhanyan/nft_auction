const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Правильный вывод средств...");
  
  // ПРАВИЛЬНЫЙ адрес контракта
  const CONTRACT_ADDRESS = "0x77D366053c51cCb9BD433f99AA5912Fb99cBFd14";
  
  // Получаем подписанта
  const [signer] = await ethers.getSigners();
  console.log("👤 Аккаунт:", signer.address);
  
  // Проверяем баланс контракта
  const provider = ethers.provider;
  const balance = await provider.getBalance(CONTRACT_ADDRESS);
  console.log("💰 Баланс контракта:", ethers.formatEther(balance), "ETH");
  
  if (balance === 0n) {
    console.log("❌ Нет средств для вывода");
    return;
  }
  
  // 1. Вариант A: Через контрактный объект (рекомендуется)
  console.log("🔗 Подключаемся к контракту...");
  
  try {
    // Получаем ABI контракта
    const contractABI = [
      "function withdrawFees() external",
      "function owner() external view returns (address)"
    ];
    
    // Создаем контракт
    const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
    
    // Проверяем владельца
    const owner = await contract.owner();
    console.log("👑 Владелец контракта:", owner);
    
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
      console.error("❌ ОШИБКА: Вы не владелец контракта!");
      console.log("   Ваш адрес:", signer.address);
      console.log("   Владелец:", owner);
      return;
    }
    
    console.log("✅ Вы владелец! Вызываем withdrawFees()...");
    
    // Вызываем функцию
    const tx = await contract.withdrawFees();
    console.log("📤 Транзакция отправлена!");
    console.log("🔗 Хэш:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("✅ Подтверждена в блоке:", receipt.blockNumber);
    console.log("🎉 Средства выведены!");
    
  } catch (error) {
    console.error("❌ Ошибка:", error.message);
    
    // 2. Вариант B: Прямой вызов через data (если вариант A не работает)
    if (error.message.includes("reverted")) {
      console.log("\n🔄 Пробуем прямой вызов функции...");
      
      // withdrawFees() signature = keccak256("withdrawFees()") = 0x853828b6
      const tx = await signer.sendTransaction({
        to: CONTRACT_ADDRESS,
        data: "0x853828b6", // ← ВАЖНО! Это сигнатура функции
        gasLimit: 50000
      });
      
      console.log("📤 Транзакция с data отправлена!");
      console.log("🔗 Хэш:", tx.hash);
      
      const receipt = await tx.wait();
      console.log("✅ Подтверждена! Блок:", receipt.blockNumber);
    }
  }
}

main().catch(console.error);