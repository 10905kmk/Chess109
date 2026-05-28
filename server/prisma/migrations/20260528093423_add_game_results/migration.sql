-- CreateTable
CREATE TABLE "game_results" (
    "id" SERIAL NOT NULL,
    "white_email" TEXT NOT NULL,
    "black_email" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_results_pkey" PRIMARY KEY ("id")
);
