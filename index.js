const crypto = require("crypto")
const { Agent } = require("undici")
const fs = require("node:fs")

module.exports.handler = async () => {
  const categories = await getCategories()

  const results = []
  await Promise.all(
    categories.map(async ({ bestGroupId }) => {
      const products = await getProductsByCategory(bestGroupId)
      await Promise.all(
        products.map(async (product) => {
          const id = product['id']
          const name = product["name"]
          const price = product["price"]['sellingPrice']
          const brand = product["brand"]["name"]
          const provider = await getProductProvider(product["id"])
          results.push({ id, name, price, brand, provider: provider ? provider["value"] : "공급자 없음" })
        }))
    }))

  const filename = "카테고리별 상품목록(30개).csv"
  const content = results.reduce((content, result) =>
    content + `${Object.values((result)).join(",")}\n`
    , "")

  fs.writeFile(filename, content, err => {
    if (err) {
      console.error(err);
    } else {
      // file written successfully
      console.log("Success")
    }
  })

  return {
    statusCode: 200,
  }
}

async function getProductProvider(id) {
  const url = `https://gift.kakao.com/a/product-detail/v2/products/${id}`
  const response = await unsafeRequest(url, "GET")
  const item = response["itemDetails"]["item"]
  const announcements = item["announcements"]
  return announcements.find(({ name }) => name == "교환권 공급자")
}

async function getProductsByCategory(id) {
  const url = `https://gift.kakao.com/a/v2/best/coupon/${id}?page=0&size=50`
  const response = await unsafeRequest(url, "GET")
  const items = response.slice(1)

  const products = items.map(({ product }) => product)
  return products
}

async function getCategories() {
  const url = "https://gift.kakao.com/a/v2/best/coupon/all?page=0&size=2"
  const response = await unsafeRequest(url, "GET")
  const categories = response[0]["groups"]
  return categories
}


async function unsafeRequest(url, method) {
  const decoder = new TextDecoder()
  const response = await fetch(url, {
    method: "GET",
    dispatcher: new Agent({
      connect: {
        rejectUnauthorized: false,
        secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
      }
    })
  })

  return JSON.parse(decoder.decode(await response.arrayBuffer()))

}