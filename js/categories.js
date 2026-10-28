export const CATEGORIES = ['식비', '카페·간식', '교통비', '숙박비', '관광·액티비티', '쇼핑', '기타'];
export const categoryOf = expense => CATEGORIES.includes(expense?.category) ? expense.category : '기타';
