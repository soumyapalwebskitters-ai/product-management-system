export type WebSlide = { id: string; type: 'image' | 'video'; src: string; alt: string }
export type WebGalleryItem = { id: string; src: string; title: string; description: string }
export type WebFaq = { id: string; question: string; answer: string }
export type WebSection = { id: string; title: string; body: string; image: string }

export type WebContent = {
  version: 1
  copy: Record<string, string>
  images: Record<string, string>
  slides: WebSlide[]
  gallery: WebGalleryItem[]
  faqs: WebFaq[]
  sections: WebSection[]
}

export const textFields = [
  { section: 'Home', key: 'Home.1', label: 'Headline' },
  { section: 'Home', key: 'Home.2', label: 'Intro' },
  { section: 'Home', key: 'Home.3', label: 'Call to action' },
  { section: 'About', key: 'About.1', label: 'About heading' },
  { section: 'About', key: 'About.2', label: 'About text' },
  { section: 'Contact', key: 'Contact.1', label: 'Contact heading' },
  { section: 'Contact', key: 'Contact.2', label: 'Contact text' },
] as const

const copy = Object.fromEntries(textFields.map((field) => [field.key, '']))

export const defaultWebContent: WebContent = {
  version: 1,
  copy,
  images: {
    'story.image': '',
    'home.hero': '',
    'about.image': '',
  },
  slides: [],
  gallery: [],
  faqs: [],
  sections: [],
}
