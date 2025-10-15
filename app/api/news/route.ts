import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.NEWS_API_KEY;
    
    if (!apiKey) {
      // Return mock data if no API key
      return NextResponse.json(getMockNews());
    }

    const response = await fetch(
      `https://newsapi.org/v2/everything?q=stock+market+OR+cryptocurrency+OR+finance&sortBy=publishedAt&language=en&pageSize=20&apiKey=${apiKey}`
    );

    if (!response.ok) {
      return NextResponse.json(getMockNews());
    }

    const data = await response.json();

    const articles = data.articles.map((article: any) => ({
      id: article.url,
      title: article.title,
      description: article.description,
      url: article.url,
      image: article.urlToImage,
      source: article.source.name,
      publishedAt: article.publishedAt,
    }));

    return NextResponse.json(articles);
  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json(getMockNews());
  }
}

function getMockNews() {
  return [
    {
      id: '1',
      title: 'Stock Market Reaches New Heights Amid Economic Recovery',
      description: 'Major indices continue their upward trajectory as economic indicators show strong recovery signals.',
      url: '#',
      image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800',
      source: 'Financial Times',
      publishedAt: new Date().toISOString(),
    },
    {
      id: '2',
      title: 'Bitcoin Surges Past Key Resistance Level',
      description: 'Cryptocurrency markets see renewed interest as Bitcoin breaks through important technical barriers.',
      url: '#',
      image: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800',
      source: 'Crypto News',
      publishedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: '3',
      title: 'Tech Stocks Lead Market Rally',
      description: 'Technology sector outperforms as investors bet on continued innovation and growth.',
      url: '#',
      image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
      source: 'Bloomberg',
      publishedAt: new Date(Date.now() - 7200000).toISOString(),
    },
  ];
}
