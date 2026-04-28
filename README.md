# Gift Wishes

Telegram Mini App for wishlists of collectible Telegram gifts.

## Stack

- Next.js + TypeScript Mini App frontend in `apps/web`
- NestJS + TypeScript API/bot backend in `apps/api`
- PostgreSQL + Prisma schema in `prisma/schema.prisma`
- Gift Satellite integration through a typed backend gateway

## MVP Notes

- Wishlist data is stored locally.
- TON balances are stored in nanoTON integer strings.
- Telegram Stars payments are stubbed for extra wishlist slots and the 25 Stars transfer fee for `telegram`/`mrkt` purchases.
- Gift Satellite delivery after `tonnel`/`portals` purchase is represented by `GiftDeliveryGateway` until the real endpoint is provided.

## Setup

1. Copy `.env.example` to `.env`.
2. Install dependencies with `npm install`.
3. Run `npm run prisma:generate`.
4. Run `npm run dev -w @gift-wishes/api` and `npm run dev -w @gift-wishes/web`.

