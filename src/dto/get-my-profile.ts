import { GetMyProfileTuple } from 'src/repository/profile.query-repository';

export class GetMyProfileDto {
  memberId!: number;
  nickname!: string;
  generation!: number;
  profileImageUrl!: string;
  introduce!: string;
  followerCount!: number;
  followingCount!: number;

  constructor(
    memberId: number,
    nickname: string,
    generation: number,
    profileImageUrl: string,
    introduce: string,
    followerCount: number,
    followingCount: number,
  ) {
    this.memberId = memberId;
    this.nickname = nickname;
    this.generation = generation;
    this.profileImageUrl = profileImageUrl;
    this.introduce = introduce;
    this.followerCount = followerCount;
    this.followingCount = followingCount;
  }

  static from(tuple: GetMyProfileTuple) {
    return new GetMyProfileDto(
      tuple.memberId,
      tuple.nickname,
      tuple.generation,
      tuple.profileImageUrl,
      tuple.introduce,
      tuple.followerCount,
      tuple.followingCount,
    );
  }
}