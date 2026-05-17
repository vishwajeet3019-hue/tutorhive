# TutorHive SEO Implementation Plan

## New positioning

Primary homepage positioning:

`Personalized Online Tuition for School Students`

Primary parent-facing promises:

- Expert-guided online tutoring
- Personalized learning for every student
- Free Demo Class
- Maths, science, English, and CBSE support
- Classes 1-10, with a dedicated Class 1-10 acquisition page

## Homepage copy now used

Hero H1:

`Personalized Online Tuition for School Students`

Hero paragraph:

`Expert-guided online classes for Classes 1-10 with maths, science, English, and CBSE support. Built for parents who want clearer concepts, stronger marks, and steady academic confidence.`

Primary CTA:

`Book Free Demo Class`

Secondary CTA:

`Explore Online Tuition`

## Landing pages created

| Intent | URL |
| --- | --- |
| Online tuition for younger learners | `/online-tuition-class-1-10/` |
| Online maths tuition | `/online-maths-tuition/` |
| Online science tuition | `/online-science-tuition/` |
| English tuition for kids | `/english-tuition-for-kids/` |
| CBSE online tuition | `/cbse-online-tuition/` |
| Science tuition for Class 8 | `/science-tuition-class-8/` |

Each page includes:

- SEO title
- Meta description
- Canonical URL
- Breadcrumbs
- Parent-focused copy
- FAQs
- FAQ schema
- Internal links to sibling pages
- Free Demo Class CTA

## Metadata matrix

| Page | SEO title | Meta description |
| --- | --- | --- |
| Home | `Personalized Online Tuition for School Students \| TutorHive` | `Personalized online tuition for school students in India. Expert-guided maths, science, English, and CBSE support with a Free Demo Class for Classes 1-10.` |
| Classes 1-10 | `Online Tuition for Class 1-10 \| Free Demo Class \| TutorHive` | `Personalized online tuition for Class 1-10 students in India. Build strong foundations in maths, science, and English with expert-guided classes and a Free Demo Class.` |
| Maths | `Online Maths Tuition in India \| Free Demo Class \| TutorHive` | `Online maths tuition for school students in India. Improve concept clarity, problem-solving, and marks with personalized classes and a Free Demo Class.` |
| Science | `Online Science Tuition for School Students \| TutorHive` | `Online science tuition for school students in India. Personalized physics, chemistry, biology, and revision support with a Free Demo Class.` |
| English | `English Tuition for Kids \| Online Classes \| TutorHive` | `English tuition for kids with personalized online classes for reading, grammar, writing, comprehension, and school confidence. Book a Free Demo Class.` |
| CBSE | `CBSE Online Tuition in India \| Free Demo Class \| TutorHive` | `CBSE online tuition in India for school students. Personalized maths, science, English, revision, and exam support with a Free Demo Class.` |

## Internal linking model

Homepage:

- Link subject cards to all primary tuition landing pages
- Link hero CTA to demo booking
- Link only low-priority footer paths to `/teach/` and `/careers/`

Subject pages:

- Maths page links to CBSE, Classes 1-10, and science pages
- Science page links to Class 8 science, CBSE, and maths pages
- English page links to Classes 1-10, maths, and CBSE pages
- CBSE page links to maths, science, and English pages

Blog:

- Every future post should include 2-3 contextual links into the tuition cluster
- Posts about maths should point to `/online-maths-tuition/`
- Posts about CBSE should point to `/cbse-online-tuition/`
- Posts about younger children should point to `/online-tuition-class-1-10/`

## 20 parent-focused blog titles

1. How to Improve Your Child's Maths Marks
2. Benefits of Online Tuition for CBSE Students
3. Best Study Habits for School Students
4. How to Know If Your Child Needs Extra Tuition
5. How to Build Maths Confidence in Primary School
6. Online Tuition vs Home Tuition: What Should Parents Choose?
7. How Parents Can Support CBSE Exam Preparation at Home
8. Why Children Struggle With Word Problems
9. How to Improve English Writing Skills for Kids
10. Science Revision Tips for Class 8 Students
11. How Often Should a Child Take Tuition Classes?
12. What Makes a Good Online Tutor for Kids?
13. CBSE Study Plan for the New Academic Year
14. How to Reduce Homework Stress at Home
15. Signs Your Child Has Concept Gaps in Maths
16. How Personalized Learning Helps School Students
17. Reading Habits That Improve English Fluency
18. How to Prepare for Unit Tests Without Last-Minute Panic
19. Class 1-10 Learning Milestones Parents Should Notice
20. Questions to Ask Before Choosing an Online Tuition Platform

Seed posts already created:

- `/blog/how-to-improve-your-childs-maths-marks/`
- `/blog/benefits-of-online-tuition-for-cbse-students/`
- `/blog/best-study-habits-for-school-students/`

## Technical SEO checklist

- [x] Parent-first homepage title, meta description, H1, and CTA
- [x] Tuition pages moved to descriptive, crawlable URLs
- [x] Hash-fragment URLs removed from sitemap
- [x] Dashboard marked `noindex,nofollow`
- [x] `EducationalOrganization`, `LocalBusiness`, `FAQPage`, and breadcrumb schema added
- [x] Hiring content moved under `/teach/` and `/careers/`
- [x] Blog hub created with parent-intent topics
- [ ] Add real founder/company address if available to strengthen LocalBusiness data
- [ ] Add measured student outcome data once collected
- [ ] Publish 2 blog posts per week for the first 10 weeks
- [ ] Request indexing in Google Search Console after deploy

## Breadcrumb pattern

- Home > Online Tuition for Class 1-10
- Home > Online Maths Tuition
- Home > Online Science Tuition
- Home > English Tuition for Kids
- Home > CBSE Online Tuition
- Home > Science Tuition for Class 8

## Image alt text strategy

Use factual, specific descriptions:

- `Child attending an online maths tuition class`
- `Tutor explaining science concepts during an online lesson`
- `Parent reviewing a student's weekly progress update`

Avoid keyword stuffing and decorative filler.

## Page speed priorities

1. Convert large images to WebP or AVIF where possible.
2. Keep hero media lightweight and size-aware.
3. Lazy-load non-critical images below the fold.
4. Reduce unused CSS/JS on static tuition pages.
5. Add explicit image dimensions to reduce layout shift.

## Optional React / Next.js future helpers

```tsx
export function SeoHead({
  title,
  description,
  canonical,
}: {
  title: string;
  description: string;
  canonical: string;
}) {
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
    </>
  );
}
```

```tsx
export function FaqJsonLd({
  items,
}: {
  items: { question: string; answer: string }[];
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.answer,
            },
          })),
        }),
      }}
    />
  );
}
```
