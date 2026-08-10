import math


def convert_to_grid(
    latitude: float,
    longitude: float,
) -> tuple[int, int]:
    """
    위도/경도를 기상청 단기예보 격자 좌표(nx, ny)로 변환합니다.

    Args:
        latitude: 위도
        longitude: 경도

    Returns:
        (nx, ny): 기상청 격자 좌표
    """

    # 기상청 격자 기준값
    RE = 6371.00877
    GRID = 5.0

    SLAT1 = 30.0
    SLAT2 = 60.0

    OLON = 126.0
    OLAT = 38.0

    XO = 43
    YO = 136

    DEGRAD = math.pi / 180.0

    re = RE / GRID

    slat1 = SLAT1 * DEGRAD
    slat2 = SLAT2 * DEGRAD
    olon = OLON * DEGRAD
    olat = OLAT * DEGRAD

    sn = (
        math.log(
            math.cos(slat1) / math.cos(slat2)
        )
        / math.log(
            math.tan(math.pi * 0.25 + slat2 * 0.5)
            / math.tan(math.pi * 0.25 + slat1 * 0.5)
        )
    )

    sf = (
        math.pow(
            math.tan(math.pi * 0.25 + slat1 * 0.5),
            sn,
        )
        * math.cos(slat1)
        / sn
    )

    ro = (
        re
        * sf
        / math.pow(
            math.tan(math.pi * 0.25 + olat * 0.5),
            sn,
        )
    )

    ra = (
        re
        * sf
        / math.pow(
            math.tan(
                math.pi * 0.25
                + latitude * DEGRAD * 0.5
            ),
            sn,
        )
    )

    theta = longitude * DEGRAD - olon

    if theta > math.pi:
        theta -= 2.0 * math.pi

    if theta < -math.pi:
        theta += 2.0 * math.pi

    theta *= sn

    nx = math.floor(
        ra * math.sin(theta) + XO + 0.5
    )

    ny = math.floor(
        ro - ra * math.cos(theta) + YO + 0.5
    )

    return nx, ny

if __name__ == "__main__":
    # 전주시청 근처 좌표
    latitude = 35.8242
    longitude = 127.1480

    nx, ny = convert_to_grid(
        latitude,
        longitude,
    )

    print("latitude:", latitude)
    print("longitude:", longitude)
    print("nx:", nx)
    print("ny:", ny)