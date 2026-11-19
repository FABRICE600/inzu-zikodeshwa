import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// 1. Users table (supports both Firebase Google Auth UID and local JWT + bcrypt phone/email accounts)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  role: text('role').notNull().default('tenant'), // 'tenant' | 'landlord' | 'admin'
  fullName: text('full_name').notNull(),
  email: text('email').unique(),
  phone: text('phone').unique(),
  whatsapp: text('whatsapp'),
  passwordHash: text('password_hash'),
  photoUrl: text('photo_url'),
  bio: text('bio'),
  phoneVerified: boolean('phone_verified').notNull().default(false),
  isSuspended: boolean('is_suspended').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. OTP codes for phone verification and SMS/email password reset
export const otpCodes = pgTable('otp_codes', {
  id: serial('id').primaryKey(),
  target: text('target').notNull(), // normalized phone or email
  purpose: text('purpose').notNull(), // 'verify_phone' | 'reset_password'
  code: text('code').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  used: boolean('used').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Rental property listings
export const listings = pgTable('listings', {
  id: serial('id').primaryKey(),
  landlordId: integer('landlord_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  propertyType: text('property_type').notNull(), // house | apartment | single_room | shared_room | studio | hostel | commercial
  priceRwf: integer('price_rwf').notNull(),
  depositRwf: integer('deposit_rwf').notNull().default(0),
  bedrooms: integer('bedrooms').notNull().default(1),
  bathrooms: integer('bathrooms').notNull().default(1),
  sizeSqm: integer('size_sqm'),
  furnished: boolean('furnished').notNull().default(false),
  province: text('province').notNull(),
  district: text('district').notNull(),
  sector: text('sector').notNull(),
  cell: text('cell'),
  streetLandmark: text('street_landmark').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  amenities: jsonb('amenities').$type<string[]>().notNull().default([]),
  rules: jsonb('rules').$type<string[]>().notNull().default([]),
  availableFrom: text('available_from').notNull(), // YYYY-MM-DD
  status: text('status').notNull().default('available'), // available | rented | hidden
  approvalStatus: text('approval_status').notNull().default('pending'), // pending | approved | rejected
  viewsCount: integer('views_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 4. Listing photos (1 to 15 per listing, ordered, with cover selection)
export const listingPhotos = pgTable('listing_photos', {
  id: serial('id').primaryKey(),
  listingId: integer('listing_id')
    .references(() => listings.id, { onDelete: 'cascade' })
    .notNull(),
  url: text('url').notNull(),
  displayOrder: integer('display_order').notNull().default(0),
  isCover: boolean('is_cover').notNull().default(false),
});

// 5. Tenant favorite listings
export const favorites = pgTable(
  'favorites',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    listingId: integer('listing_id')
      .references(() => listings.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('favorites_user_listing_idx').on(table.userId, table.listingId)]
);

// 6. Tenant saved searches with new-match notification preference
export interface SavedSearchFilters {
  q?: string;
  province?: string;
  district?: string;
  sector?: string;
  minPrice?: number;
  maxPrice?: number;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  furnished?: string;
  amenities?: string[];
  landmark?: string;
  maxDistanceKm?: number;
}

export const savedSearches = pgTable('saved_searches', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  filters: jsonb('filters').$type<SavedSearchFilters>().notNull(),
  notifyEnabled: boolean('notify_enabled').notNull().default(true),
  lastCheckedAt: timestamp('last_checked_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 7. Viewing requests & direct landlord inquiries
export const viewingRequests = pgTable('viewing_requests', {
  id: serial('id').primaryKey(),
  listingId: integer('listing_id')
    .references(() => listings.id, { onDelete: 'cascade' })
    .notNull(),
  tenantId: integer('tenant_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  landlordId: integer('landlord_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  requestType: text('request_type').notNull().default('viewing'), // 'viewing' | 'message'
  preferredDate: text('preferred_date'),
  preferredTime: text('preferred_time'),
  message: text('message').notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'confirmed' | 'declined'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 8. Listing reports for moderation
export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  listingId: integer('listing_id')
    .references(() => listings.id, { onDelete: 'cascade' })
    .notNull(),
  reporterId: integer('reporter_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  reason: text('reason').notNull(),
  details: text('details'),
  status: text('status').notNull().default('open'), // 'open' | 'resolved' | 'dismissed'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Drizzle Relations
export const usersRelations = relations(users, ({ many }) => ({
  listings: many(listings),
  favorites: many(favorites),
  savedSearches: many(savedSearches),
  sentRequests: many(viewingRequests, { relationName: 'tenantRequests' }),
  receivedRequests: many(viewingRequests, { relationName: 'landlordRequests' }),
  reports: many(reports),
}));

export const listingsRelations = relations(listings, ({ one, many }) => ({
  landlord: one(users, {
    fields: [listings.landlordId],
    references: [users.id],
  }),
  photos: many(listingPhotos),
  favorites: many(favorites),
  viewingRequests: many(viewingRequests),
  reports: many(reports),
}));

export const listingPhotosRelations = relations(listingPhotos, ({ one }) => ({
  listing: one(listings, {
    fields: [listingPhotos.listingId],
    references: [listings.id],
  }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, {
    fields: [favorites.userId],
    references: [users.id],
  }),
  listing: one(listings, {
    fields: [favorites.listingId],
    references: [listings.id],
  }),
}));

export const savedSearchesRelations = relations(savedSearches, ({ one }) => ({
  user: one(users, {
    fields: [savedSearches.userId],
    references: [users.id],
  }),
}));

export const viewingRequestsRelations = relations(viewingRequests, ({ one }) => ({
  listing: one(listings, {
    fields: [viewingRequests.listingId],
    references: [listings.id],
  }),
  tenant: one(users, {
    fields: [viewingRequests.tenantId],
    references: [users.id],
    relationName: 'tenantRequests',
  }),
  landlord: one(users, {
    fields: [viewingRequests.landlordId],
    references: [users.id],
    relationName: 'landlordRequests',
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  listing: one(listings, {
    fields: [reports.listingId],
    references: [listings.id],
  }),
  reporter: one(users, {
    fields: [reports.reporterId],
    references: [users.id],
  }),
}));
