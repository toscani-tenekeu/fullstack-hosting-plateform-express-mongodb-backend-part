import { seedOffersData } from '../data/offers'
import { OfferModel } from '../models/offer'

export async function seedOffers() {
  const operations = seedOffersData.map((offer) => ({
    updateOne: {
      filter: { slug: offer.slug },
      update: {
        $set: {
          type: offer.type,
          plan: offer.plan,
          slug: offer.slug,
          pricePerYear: offer.pricePerYear,
          currency: 'XAF' as const,
          features: offer.features,
        },
      },
      upsert: true,
    },
  }))

  if (operations.length > 0) {
    await OfferModel.bulkWrite(operations, { ordered: false })
  }

  return OfferModel.find({ slug: { $in: seedOffersData.map((item) => item.slug) } }).sort({ type: 1, pricePerYear: 1 })
}
