import { ethers } from "ethers";
import { BASE_RPC_URL, AVAX_RPC_URL } from "./contracts_config";

let baseProvider: ethers.JsonRpcProvider | null = null;
let avaxProvider: ethers.JsonRpcProvider | null = null;

export function getBaseProvider(): ethers.JsonRpcProvider {
  if (!baseProvider) {
    baseProvider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  }
  return baseProvider;
}

export function getAvaxProvider(): ethers.JsonRpcProvider {
  if (!avaxProvider) {
    avaxProvider = new ethers.JsonRpcProvider(AVAX_RPC_URL);
  }
  return avaxProvider;
}

export function getContract(
  address: string,
  abi: string[],
  chain: "base" | "avax" = "base"
): ethers.Contract {
  const provider = chain === "base" ? getBaseProvider() : getAvaxProvider();
  return new ethers.Contract(address, abi, provider);
}
