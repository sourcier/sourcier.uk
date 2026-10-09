import {
  getPublicationStatus,
  isPublished,
  type PublicationStatus,
} from "./drafts";

interface SeriesPost {
  id: string;
  data: {
    title: string;
    draft: boolean;
    pubDate: Date;
    series?: string;
    seriesOrder?: number;
  };
}

export interface SeriesLink {
  id: string;
  title: string;
  status: PublicationStatus;
}

export interface SeriesNavigationData {
  overview: SeriesLink;
  order: number;
  total: number;
  previous?: SeriesLink;
  next?: SeriesLink;
}

export function getSeriesNavigation(
  posts: SeriesPost[],
  isVisible: (post: SeriesPost) => boolean = isPublished,
): Map<string, SeriesNavigationData> {
  const groups = new Map<string, SeriesPost[]>();
  for (const post of posts) {
    const { series, seriesOrder } = post.data;
    if ((series === undefined) !== (seriesOrder === undefined)) {
      throw new Error(
        `Post "${post.id}" must supply both series and seriesOrder`,
      );
    }
    if (series === undefined) continue;
    const group = groups.get(series) ?? [];
    group.push(post);
    groups.set(series, group);
  }

  const navigation = new Map<string, SeriesNavigationData>();
  for (const [series, group] of groups) {
    const orders = new Set<number>();
    for (const post of group) {
      const order = post.data.seriesOrder!;
      if (!Number.isInteger(order) || order < 0 || orders.has(order)) {
        throw new Error(
          `Invalid or duplicate reading order in series "${series}": ${order}`,
        );
      }
      orders.add(order);
    }
    const overview = group.find((post) => post.data.seriesOrder === 0);
    if (!overview || overview.id !== series) {
      throw new Error(
        `Series "${series}" needs an overview with the same ID and seriesOrder: 0`,
      );
    }
    if (!isVisible(overview)) continue;
    const parts = group
      .filter((post) => post !== overview && isVisible(post))
      .sort((a, b) => a.data.seriesOrder! - b.data.seriesOrder!);

    const link = (post: SeriesPost): SeriesLink => ({
      id: post.id,
      title: post.data.title,
      status: getPublicationStatus(post),
    });
    const overviewLink = link(overview);
    navigation.set(overview.id, {
      overview: overviewLink,
      order: 0,
      total: parts.length,
      next: parts[0] ? link(parts[0]) : undefined,
    });
    parts.forEach((post, index) => {
      navigation.set(post.id, {
        overview: overviewLink,
        order: post.data.seriesOrder!,
        total: parts.length,
        previous: parts[index - 1] ? link(parts[index - 1]) : overviewLink,
        next: parts[index + 1] ? link(parts[index + 1]) : undefined,
      });
    });
  }
  return navigation;
}
