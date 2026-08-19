import { defineCollection, z } from 'astro:content';

// ---------------------------------------------------------------------------
// Shared fragments
// ---------------------------------------------------------------------------
const seo = z.object({
  seoTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogImage: z.string().optional(),
});

const cta = z.object({
  label: z.string(),
  href: z.string(),
  style: z.enum(['primary', 'secondary', 'ghost']).default('primary'),
});

// ---------------------------------------------------------------------------
// Global business settings (single file collection)
// ---------------------------------------------------------------------------
const settings = defineCollection({
  type: 'data',
  schema: z.object({
    businessName: z.string(),
    tagline: z.string().optional(),
    logo: z.string(),
    favicon: z.string().optional(),
    address: z.string(),
    locationDescription: z.string(),
    operatingHours: z.string(),
    operatingHoursStart: z.string(), // 24h "06:00"
    operatingHoursEnd: z.string(), // 24h "03:00" (next day)
    contact: z.object({
      mobile: z.string(),
      mobileIsDummy: z.boolean().default(true),
      email: z.string(),
      emailIsDummy: z.boolean().default(true),
      facebook: z.string(),
      facebookIsDummy: z.boolean().default(true),
      messenger: z.string().optional(),
      mapEmbedUrl: z.string().optional(),
      mapUrl: z.string().optional(),
    }),
    social: z.object({
      facebook: z.string().optional(),
      instagram: z.string().optional(),
      tiktok: z.string().optional(),
      youtube: z.string().optional(),
    }).optional(),
    announcementBar: z.object({
      enabled: z.boolean().default(false),
      message: z.string().optional(),
      link: z.string().optional(),
    }).optional(),
    bookingButtonText: z.string().default('Book a Court'),
    // URL of the separately-deployed booking system (see /bookingsystem in
    // the sibling repo) — every "Book Now" CTA on this site links out to
    // this URL instead of hosting a booking form locally. Update this once
    // the booking system is deployed (e.g. to its Netlify URL).
    bookingUrl: z.string().default('https://your-booking-system.example.com/book'),
    footer: z.object({
      description: z.string().optional(),
      copyrightName: z.string().optional(),
    }).optional(),
    defaultSeo: seo.optional(),
  }),
});

// ---------------------------------------------------------------------------
// Pages (heading, description, hero image, SEO, content sections)
// ---------------------------------------------------------------------------
const pages = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    heading: z.string(),
    subheading: z.string().optional(),
    description: z.string().optional(),
    heroImage: z.string().optional(),
    heroImageAlt: z.string().optional(),
    ctas: z.array(cta).optional(),
    published: z.boolean().default(true),
    ...seo.shape,
  }),
});

// ---------------------------------------------------------------------------
// Rates & Packages
// ---------------------------------------------------------------------------
const rates = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
    description: z.string(),
    price: z.string(), // free text placeholder e.g. "Starting at ₱250/hour"
    billingUnit: z.string().default('per hour'),
    peakOrOffPeak: z.enum(['peak', 'off-peak', 'both', 'n/a']).default('n/a'),
    category: z.enum(['court-rental', 'equipment', 'coaching', 'open-play', 'group', 'tournament', 'corporate', 'private-event']),
    features: z.array(z.string()).default([]),
    isPlaceholderPrice: z.boolean().default(true),
    displayOrder: z.number().default(0),
    featured: z.boolean().default(false),
    published: z.boolean().default(true),
  }),
});

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
const events = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    image: z.string(),
    imageAlt: z.string().optional(),
    excerpt: z.string(),
    date: z.string(), // ISO date
    startTime: z.string(), // "17:00"
    endTime: z.string(), // "20:00"
    registrationDeadline: z.string().optional(),
    category: z.enum([
      "Men's Doubles", "Women's Doubles", "Mixed Doubles", 'Beginner Division',
      'Intermediate Division', 'Open Division', 'All-Male Open Play', 'Clinic', 'Open Play', 'Community',
    ]),
    skillLevel: z.string().default('All Levels'),
    fee: z.string(),
    maxParticipants: z.number().optional(),
    availableSlots: z.number().optional(),
    format: z.string().optional(),
    rules: z.string().optional(),
    prizes: z.string().optional(),
    registrationLink: z.string().optional(),
    status: z.enum(['Upcoming', 'Registration Open', 'Registration Closed', 'Ongoing', 'Completed', 'Cancelled']),
    featured: z.boolean().default(false),
    published: z.boolean().default(true),
  }),
});

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------
const gallery = defineCollection({
  type: 'data',
  schema: z.object({
    image: z.string(),
    thumbnail: z.string().optional(),
    title: z.string(),
    caption: z.string().optional(),
    alt: z.string(),
    category: z.enum([
      'Court', 'Casual Games', "Men's Doubles", "Women's Doubles", 'Mixed Doubles',
      'Open Play', 'Tournaments', 'Families', 'Community', 'Awarding', 'Private Events',
    ]),
    date: z.string().optional(),
    displayOrder: z.number().default(0),
    featured: z.boolean().default(false),
    published: z.boolean().default(true),
  }),
});

// ---------------------------------------------------------------------------
// Videos (Facebook Reels)
// ---------------------------------------------------------------------------
const videos = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    facebookReelUrl: z.string(),
    approvedEmbedUrl: z.string(),
    posterImage: z.string(),
    posterImageAlt: z.string().optional(),
    category: z.string().default('Highlights'),
    date: z.string().optional(),
    displayOrder: z.number().default(0),
    featured: z.boolean().default(false),
    published: z.boolean().default(true),
  }),
});

// ---------------------------------------------------------------------------
// Testimonials
// ---------------------------------------------------------------------------
const testimonials = defineCollection({
  type: 'data',
  schema: z.object({
    customerName: z.string(),
    customerType: z.string(),
    avatar: z.string().optional(),
    rating: z.number().min(1).max(5).default(5),
    testimonial: z.string(),
    displayOrder: z.number().default(0),
    featured: z.boolean().default(false),
    published: z.boolean().default(true),
  }),
});

// ---------------------------------------------------------------------------
// FAQs
// ---------------------------------------------------------------------------
const faqs = defineCollection({
  type: 'data',
  schema: z.object({
    question: z.string(),
    answer: z.string(),
    category: z.enum(['Booking', 'Rates & Payment', 'Venue & Hours', 'Rules & Policies', 'Events', 'Equipment']),
    displayOrder: z.number().default(0),
    published: z.boolean().default(true),
    useAsChatbotAnswer: z.boolean().default(true),
  }),
});

// ---------------------------------------------------------------------------
// Add-ons (booking options)
// ---------------------------------------------------------------------------
const addons = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
    description: z.string().optional(),
    price: z.string(),
    unit: z.string().default('per session'),
    icon: z.string().default('paddle'),
    displayOrder: z.number().default(0),
    published: z.boolean().default(true),
  }),
});

// ---------------------------------------------------------------------------
// Chatbot (single file)
// ---------------------------------------------------------------------------
const chatbot = defineCollection({
  type: 'data',
  schema: z.object({
    enabled: z.boolean().default(true),
    chatbotName: z.string().default('Rally Assistant'),
    greeting: z.string(),
    fallbackMessage: z.string(),
    notificationDelaySeconds: z.number().default(4),
    quickReplies: z.array(z.object({
      label: z.string(),
      intent: z.string(),
    })),
    bookingLink: z.string().default('/book'),
    contactActions: z.array(z.object({
      label: z.string(),
      type: z.enum(['call', 'email', 'facebook', 'contact-form', 'link']),
      value: z.string(),
    })),
  }),
});

// ---------------------------------------------------------------------------
// Home page structured sections (single file, repeatable card lists)
// ---------------------------------------------------------------------------
const homeContent = defineCollection({
  type: 'data',
  schema: z.object({
    highlights: z.array(z.object({
      icon: z.string().default('court'),
      title: z.string(),
      description: z.string(),
    })),
    whyChooseUs: z.array(z.object({
      icon: z.string().default('check'),
      title: z.string(),
      description: z.string(),
      isPlaceholder: z.boolean().default(false),
    })),
    stats: z.array(z.object({
      label: z.string(),
      value: z.number(),
      suffix: z.string().default('+'),
      isDummy: z.boolean().default(true),
    })),
    bookingSteps: z.array(z.object({
      step: z.number(),
      title: z.string(),
      description: z.string(),
    })),
  }),
});

// ---------------------------------------------------------------------------
// About page structured sections
// ---------------------------------------------------------------------------
const aboutContent = defineCollection({
  type: 'data',
  schema: z.object({
    values: z.array(z.object({
      title: z.string(),
      description: z.string(),
    })),
    team: z.array(z.object({
      name: z.string(),
      role: z.string(),
      photo: z.string().optional(),
      isPlaceholder: z.boolean().default(true),
    })),
    partners: z.array(z.object({
      name: z.string(),
      description: z.string().optional(),
      logo: z.string().optional(),
    })),
  }),
});

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------
const policies = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    lastUpdated: z.string().optional(),
    published: z.boolean().default(true),
  }),
});

export const collections = {
  settings,
  pages,
  rates,
  events,
  gallery,
  videos,
  testimonials,
  faqs,
  addons,
  chatbot,
  policies,
  homeContent,
  aboutContent,
};
