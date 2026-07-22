import BookingClient from './booking-client';

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	return <BookingClient slug={slug} />;
}
