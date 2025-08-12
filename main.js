import time
from web3 import Web3
from colorama import Fore, Style, init
from tqdm import tqdm
import concurrent.futures

# 初始化 Colorama
init(autoreset=True)

# Web3 连接配置
RPC_URL = "https://monad-testnet.blockvision.org/v1/2uHmC8jTpQQfV2L681tiPCel35G"  # 请替换为实际的 RPC URL
web3 = Web3(Web3.HTTPProvider(RPC_URL))

# 合约地址和 ABI
CONTRACT_ADDRESS = "0xA9E028DC3FaCdE03596608316d132778CFbcf8Dd"
ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "_tokenAddr", "type": "address"},
            {"internalType": "uint256", "name": "tokenid", "type": "uint256"},
            {"internalType": "address[]", "name": "addrs", "type": "address[]"}
        ],
        "name": "getTokenBalances",
        "outputs": [{"internalType": "uint256[]", "name": "balances", "type": "uint256[]"}],
        "stateMutability": "view",
        "type": "function"
    }
]

# 加载合约
contract = web3.eth.contract(address=CONTRACT_ADDRESS, abi=ABI)

# 默认参数
DEFAULT_TOKEN_ADDR = "0x000000000000000000000000000000000000bEEF"
DEFAULT_TOKEN_ID = 1234567890987654321

# 处理用户输入地址
def read_addresses_from_input():
    print(f"{Fore.CYAN}请输入多个地址，每行一个地址，输入完成后按 Enter 两次结束输入：{Style.RESET_ALL}")
    addresses = []
    while True:
        line = input()
        if not line:
            break
        addresses.append(line.strip())
    return addresses

# 查询余额（分批处理）
def get_token_balances(token_addr, token_id, addresses, batch_size=50, retries=3, delay=5):
    batches = [addresses[i:i + batch_size] for i in range(0, len(addresses), batch_size)]
    results = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [
            executor.submit(call_contract_with_retry, token_addr, token_id, batch, retries, delay)
            for batch in batches
        ]
        for future in tqdm(concurrent.futures.as_completed(futures), total=len(futures), desc="查询中", colour="cyan"):
            batch_result = future.result()
            if batch_result:
                results.extend(batch_result)
            else:
                print(f"{Fore.RED}部分查询失败{Style.RESET_ALL}")
    return results

# 调用合约函数（带重试）
def call_contract_with_retry(token_addr, token_id, addresses, retries, delay):
    for attempt in range(retries):
        try:
            checksum_addresses = [web3.to_checksum_address(addr) for addr in addresses]
            balances = contract.functions.getTokenBalances(token_addr, token_id, checksum_addresses).call()
            return list(zip(addresses, balances))
        except Exception as e:
            if attempt < retries - 1:
                print(f"{Fore.YELLOW}查询失败，正在重试 ({attempt + 1}/{retries})...{Style.RESET_ALL}")
                time.sleep(delay)
            else:
                print(f"{Fore.RED}查询失败: {e}{Style.RESET_ALL}")
                return None

# 导出结果到文件
def export_results(with_balance, without_balance):
    with open("with_balance.txt", "w") as file:
        for address, balance in with_balance:
            file.write(f"{address}: {balance}\n")
    with open("without_balance.txt", "w") as file:
        for address, balance in without_balance:
            file.write(f"{address}: {balance}\n")

# 主函数
def main():
    print(f"{Fore.BLUE}欢迎使用大币哥批量余额查询工具 @BTC_0x001{Style.RESET_ALL}")

    addresses = read_addresses_from_input()
    if not addresses:
        print(f"{Fore.RED}无输入地址，退出{Style.RESET_ALL}")
        return
    print(f"{Fore.CYAN}您粘贴了 {len(addresses)} 个地址{Style.RESET_ALL}")

    print(f"{Fore.YELLOW}正在查询中，请不要关闭窗口...{Style.RESET_ALL}")

    start_time = time.time()
    results = get_token_balances(DEFAULT_TOKEN_ADDR, DEFAULT_TOKEN_ID, addresses)
    end_time = time.time()
    total_time = end_time - start_time

    if results:
        with_balance = []
        without_balance = []
        for addr, balance in results:
            balance_eth = balance / 1e18  # 假设余额单位为 10^18
            if balance_eth > 0:
                with_balance.append((addr, balance_eth))
            else:
                without_balance.append((addr, balance_eth))
            print(f"{Fore.GREEN}地址: {addr}, 余额: {balance_eth} MON{Style.RESET_ALL}")

        export_results(with_balance, without_balance)

        print(f"\n{Fore.MAGENTA}查询完成！{Style.RESET_ALL}")
        print(f"{Fore.GREEN}有余额的地址数量: {len(with_balance)}{Style.RESET_ALL}")
        print(f"{Fore.BLUE}无余额的地址数量: {len(without_balance)}{Style.RESET_ALL}")
        print(f"{Fore.CYAN}查询总用时: {total_time:.2f} 秒{Style.RESET_ALL}")
        print(f"{Fore.CYAN}结果已导出到 with_balance.txt 和 without_balance.txt{Style.RESET_ALL}")
    else:
        print(f"{Fore.RED}查询失败，请检查网络连接或参数设置{Style.RESET_ALL}")

    input(f"{Fore.BLUE}按 Enter 键退出...{Style.RESET_ALL}")

if __name__ == "__main__":
    main()
